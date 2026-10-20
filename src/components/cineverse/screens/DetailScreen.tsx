'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight, Award, BookmarkCheck, BookmarkPlus, Clapperboard, Download, ExternalLink,
  Heart, Loader2, Play, RefreshCw, Server, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useNav, usePlayer } from '@/lib/store'
import { genreFa } from '@/lib/providers/metadata'
import { resolveDirectDownload, type DirectDownload } from '@/lib/download'
import type { DetailData, EpisodeDTO, HistoryItemDTO, MType, SeasonDTO } from '@/lib/types'
import { PosterCard } from '../PosterCard'
import { PosterImg } from '../PosterImg'
import { ErrorState, EmptyState } from '../States'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ————————————————————————— helpers —————————————————————————

/** "132 min" | "2h 12min" → «۱۳۲ دقیقه» | «۲ ساعت و ۱۲ دقیقه» (raw fallback) */
function runtimeFa(rt: string | null): string | null {
  if (!rt) return null
  const mins = rt.trim().match(/^(\d+)\s*min/i)
  if (mins) return `${mins[1]} دقیقه`
  const hrs = rt.trim().match(/^(\d+)\s*h(?:our)?s?\s*(\d+)?\s*(?:min)?/i)
  if (hrs) {
    const h = Number(hrs[1])
    const m = Number(hrs[2] ?? 0)
    return m ? `${h} ساعت و ${m} دقیقه` : `${h} ساعت`
  }
  return rt
}

function airDateFa(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

function episodeHistoryMap(history: HistoryItemDTO[] | undefined, imdbId: string) {
  const map = new Map<string, HistoryItemDTO>()
  for (const h of history ?? []) {
    if (h.imdbId !== imdbId || h.season == null || h.episode == null) continue
    map.set(`${h.season}:${h.episode}`, h)
  }
  return map
}

// ————————————————————————— screen —————————————————————————

interface Props {
  imdbId: string
  type: MType
}

export function DetailScreen({ imdbId, type }: Props) {
  const push = useNav((s) => s.push)
  const pop = useNav((s) => s.pop)
  const openPlayer = usePlayer((s) => s.openPlayer)
  const qc = useQueryClient()

  const detail = useQuery({
    queryKey: ['detail', type, imdbId],
    queryFn: () => api.detail(type, imdbId),
    staleTime: 60_000,
  })

  const historyQ = useQuery({
    queryKey: ['history'],
    queryFn: api.history,
    enabled: type === 'series',
    staleTime: 30_000,
  })

  const data = detail.data
  const title = data?.title

  const [seasonNo, setSeasonNo] = useState<number | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [dlState, setDlState] = useState<'idle' | 'loading' | 'found' | 'none' | 'network'>('idle')
  const [dl, setDl] = useState<DirectDownload | null>(null)

  const seasons = useMemo<SeasonDTO[]>(() => data?.seasons ?? [], [data])
  const defaultSeason = useMemo<SeasonDTO | null>(
    () => seasons.find((s) => s.number >= 1) ?? seasons[0] ?? null,
    [seasons]
  )
  const activeSeason = useMemo<SeasonDTO | null>(() => {
    if (seasons.length === 0) return null
    return seasons.find((s) => s.number === seasonNo) ?? defaultSeason
  }, [seasons, seasonNo, defaultSeason])

  const epHistory = useMemo(
    () => episodeHistoryMap(historyQ.data, imdbId),
    [historyQ.data, imdbId]
  )

  const basePayload = title
    ? { imdbId, type, title: title.title, poster: title.poster, year: title.year, rating: title.rating }
    : null

  // ——— library toggles (optimistic) ———
  const optimisticToggle = (field: 'favorite' | 'watchlist') => {
    qc.setQueryData<DetailData>(['detail', type, imdbId], (old) =>
      old ? { ...old, user: { ...old.user, [field]: !old.user[field] } } : old
    )
  }

  const onToggleFavorite = async () => {
    if (!basePayload) return
    optimisticToggle('favorite')
    try {
      const r = await api.toggleFavorite(basePayload)
      toast.success(r.favorite ? 'به علاقه‌مندی‌ها اضافه شد ❤' : 'از علاقه‌مندی‌ها حذف شد')
    } catch {
      toast.error('عملیات ناموفق بود؛ دوباره تلاش کنید')
    } finally {
      qc.invalidateQueries({ queryKey: ['detail', type, imdbId] })
      qc.invalidateQueries({ queryKey: ['favorites'] })
    }
  }

  const onToggleWatchlist = async () => {
    if (!basePayload) return
    optimisticToggle('watchlist')
    try {
      const r = await api.toggleWatchlist(basePayload)
      toast.success(r.watchlist ? 'به واچ‌لیست اضافه شد' : 'از واچ‌لیست حذف شد')
    } catch {
      toast.error('عملیات ناموفق بود؛ دوباره تلاش کنید')
    } finally {
      qc.invalidateQueries({ queryKey: ['detail', type, imdbId] })
      qc.invalidateQueries({ queryKey: ['watchlist'] })
    }
  }

  // ——— play ———
  const play = (opts?: { serverId?: string; season?: number; episode?: number; episodeName?: string | null }) => {
    if (!basePayload) return
    if (type === 'movie') {
      openPlayer({ ...basePayload, serverId: opts?.serverId })
      return
    }
    const s = opts?.season ?? defaultSeason?.number ?? 1
    const firstOfSeason = seasons.find((x) => x.number === s)?.episodes[0]
    const e = opts?.episode ?? firstOfSeason?.number ?? 1
    const name = opts?.episodeName ?? firstOfSeason?.name ?? null
    openPlayer({ ...basePayload, season: s, episode: e, episodeName: name, serverId: opts?.serverId })
  }

  // ——— download sheet ———
  const openDownload = async () => {
    if (dlState === 'loading') return
    setDlOpen(true)
    setDl(null)
    setDlState('loading')
    if (!title) return
    try {
      const res = await resolveDirectDownload(title.title, title.year)
      if (res) {
        setDl(res)
        setDlState('found')
      } else {
        setDlState('none')
      }
    } catch (err) {
      setDlState(err instanceof Error && err.message === 'network' ? 'network' : 'none')
    }
  }

  // ——— loading ———
  if (detail.isPending) return <DetailSkeleton />

  // ——— error / invalid id ———
  if (detail.isError || !data || !title) {
    const badParams = detail.error instanceof ApiError && detail.error.code === 'BAD_PARAMS'
    if (badParams) {
      return (
        <div className="h-full overflow-y-auto no-scrollbar">
          <EmptyState
            title="این عنوان یافت نشد"
            subtitle="شناسه عنوان نامعتبر است یا از پایگاه داده حذف شده است."
          />
        </div>
      )
    }
    return (
      <div className="h-full overflow-y-auto no-scrollbar pt-24">
        <ErrorState onRetry={() => detail.refetch()} />
      </div>
    )
  }

  const rating = title.rating
  const runtime = runtimeFa(title.runtime)
  const genres = title.genres ?? []
  const hasTrailer = Boolean(title.trailer)
  const secBtns = 3 + (hasTrailer ? 1 : 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="h-full overflow-y-auto no-scrollbar pb-10"
    >
      {/* ——— Backdrop ——— */}
      <div className="relative h-56 w-full shrink-0 sm:h-64">
        <PosterImg src={title.background ?? title.poster} alt={title.title} eager className="h-full w-full" />
        <div className="absolute inset-0 cine-gradient-b" aria-hidden />
        <button
          onClick={pop}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform active:scale-90"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* ——— Poster + meta ——— */}
      <div className="relative z-10 -mt-14 flex gap-3.5 px-4">
        <PosterImg
          src={title.poster}
          alt={title.title}
          eager
          className="h-[156px] w-[104px] shrink-0 rounded-xl poster-shadow"
        />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {type === 'series' ? 'سریال' : 'فیلم'}
            </span>
            {rating != null && rating > 0 && (
              <span className="flex items-center gap-0.5 rounded-md bg-black/40 px-1.5 py-0.5 text-[10.5px] font-bold text-[#f5c518] tabular-nums">
                <Star className="h-3 w-3 fill-[#f5c518]" aria-hidden /> {rating.toFixed(1)}
              </span>
            )}
            {title.status && (
              <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">{title.status}</span>
            )}
          </div>
          <h1 className="mt-1.5 text-[19px] font-black leading-7 text-foreground">{title.title}</h1>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
            {[title.year, runtime, title.country].filter(Boolean).join(' • ')}
          </p>
          {genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {genres.slice(0, 4).map((g) => (
                <span key={g} className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {genreFa(g)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ——— Actions ——— */}
      <div className="mt-5 space-y-2 px-4">
        <button
          onClick={() => play()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-bold text-primary-foreground shadow-[0_6px_24px_rgba(229,9,20,0.35)] transition-transform active:scale-[0.98]"
        >
          <Play className="h-[18px] w-[18px] fill-primary-foreground" aria-hidden />
          پخش
        </button>
        <div className={cn('grid gap-2', secBtns === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          <ActionButton
            onClick={onToggleWatchlist}
            active={data.user.watchlist}
            icon={data.user.watchlist ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <BookmarkPlus className="h-4 w-4" aria-hidden />}
            label="واچ‌لیست"
          />
          <ActionButton
            onClick={onToggleFavorite}
            active={data.user.favorite}
            icon={<Heart className={cn('h-4 w-4', data.user.favorite && 'fill-primary')} aria-hidden />}
            label="علاقه‌مندی"
          />
          {hasTrailer && (
            <ActionButton
              onClick={() => title.trailer && window.open(`https://www.youtube.com/watch?v=${title.trailer}`, '_blank', 'noopener,noreferrer')}
              icon={<Clapperboard className="h-4 w-4" aria-hidden />}
              label="تریلر"
            />
          )}
          <ActionButton onClick={openDownload} icon={<Download className="h-4 w-4" aria-hidden />} label="دانلود" />
        </div>
      </div>

      {/* ——— Servers strip ——— */}
      {data.sources.length > 0 && (
        <section className="mt-6" aria-label="سرورهای پخش">
          <h2 className="px-4 text-[13.5px] font-bold text-foreground">سرورهای پخش</h2>
          <div className="thin-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
            {data.sources.map((s) => (
              <button
                key={s.id}
                onClick={() => play({ serverId: s.id })}
                title={s.note}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-card px-3.5 py-2 text-[11.5px] font-semibold text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/5 active:scale-95"
              >
                <Server className="h-3.5 w-3.5 text-primary" aria-hidden />
                پخش با {s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ——— Description ——— */}
      {title.description && (
        <section className="mt-6 px-4" aria-label="داستان">
          <h2 className="text-[13.5px] font-bold text-foreground">داستان</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{title.description}</p>
        </section>
      )}

      {/* ——— Awards ——— */}
      {title.awards && (
        <section className="mt-5 px-4" aria-label="جوایز">
          <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
            <Award className="h-4 w-4 text-[#e87c03]" aria-hidden /> جوایز
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-muted-foreground">{title.awards}</p>
        </section>
      )}

      {/* ——— Seasons & episodes (series) ——— */}
      {type === 'series' && seasons.length > 0 && (
        <section className="mt-6" aria-label="قسمت‌ها">
          <h2 className="px-4 text-[13.5px] font-bold text-foreground">قسمت‌ها</h2>
          <div className="thin-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="انتخاب فصل">
            {seasons.map((s) => (
              <button
                key={s.number}
                role="tab"
                aria-selected={activeSeason?.number === s.number}
                onClick={() => setSeasonNo(s.number)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition-colors',
                  activeSeason?.number === s.number
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-elevated text-muted-foreground hover:text-foreground'
                )}
              >
                {s.number === 0 ? 'ویژه' : `فصل ${s.number}`}
              </button>
            ))}
          </div>
          <div className="thin-scrollbar mt-3 max-h-96 overflow-y-auto mx-4 rounded-2xl border border-border/50 bg-card">
            {activeSeason?.episodes.map((ep) => (
              <EpisodeRow
                key={ep.key}
                ep={ep}
                watched={epHistory.get(`${activeSeason.number}:${ep.number}`)}
                onPlay={() => play({ season: activeSeason.number, episode: ep.number, episodeName: ep.name })}
              />
            ))}
            {(activeSeason?.episodes.length ?? 0) === 0 && (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">قسمتی برای این فصل ثبت نشده است.</p>
            )}
          </div>
        </section>
      )}

      {/* ——— Cast & crew ——— */}
      {data.cast.length > 0 && (
        <section className="mt-7" aria-label="بازیگران">
          <h2 className="px-4 text-[13.5px] font-bold text-foreground">بازیگران</h2>
          <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4 px-4">
            {data.cast.slice(0, 14).map((c, i) => (
              <div key={`${c.name}-${i}`} className="flex flex-col items-center gap-1.5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-[16px] font-black text-primary/80">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="line-clamp-2 text-[10.5px] leading-4 text-foreground/85">{c.name}</span>
              </div>
            ))}
          </div>
          {(data.director.length > 0 || data.writer.length > 0) && (
            <div className="mt-4 space-y-1.5 px-4">
              {data.director.length > 0 && (
                <p className="text-[11.5px] leading-5 text-muted-foreground">
                  <span className="font-bold text-foreground/80">کارگردان: </span>
                  {data.director.slice(0, 3).join('، ')}
                </p>
              )}
              {data.writer.length > 0 && (
                <p className="text-[11.5px] leading-5 text-muted-foreground">
                  <span className="font-bold text-foreground/80">نویسنده: </span>
                  {data.writer.slice(0, 3).join('، ')}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ——— Similar ——— */}
      {data.similar.length > 0 && (
        <section className="mt-7" aria-label="عناوین مشابه">
          <h2 className="px-4 text-[13.5px] font-bold text-foreground">عناوین مشابه</h2>
          <div className="thin-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {data.similar.map((item) => (
              <PosterCard
                key={item.imdbId}
                item={item}
                onClick={() => push({ name: 'detail', imdbId: item.imdbId, type: item.type })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ——— Download sheet ——— */}
      <Dialog open={dlOpen} onOpenChange={setDlOpen}>
        <DialogContent
          className="bottom-0 top-auto h-auto max-h-[80%] translate-y-0 gap-0 overflow-y-auto thin-scrollbar rounded-b-none rounded-t-3xl border-x-0 border-b-0 bg-card p-0 data-[state=open]:animate-in data-[state=closed]:animate-out sm:bottom-0 sm:top-auto sm:translate-y-0 sm:w-[414px] sm:left-1/2 sm:-translate-x-1/2 sm:right-auto"
          style={{ maxWidth: 'calc(100vw - 0rem)' }}
        >
          <DialogHeader className="border-b border-border px-5 pb-3 pt-4">
            <DialogTitle className="text-right text-[15px] font-bold">دانلود مستقیم</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-5">
            {dlState === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-[12.5px] font-semibold">در حال جست‌وجوی نسخهٔ آزاد در آرشیو اینترنت…</p>
                <p className="text-[10.5px] leading-5 text-muted-foreground">این جست‌وجو مستقیماً از مرورگر شما انجام می‌شود و ممکن است چند ثانیه طول بکشد.</p>
              </div>
            )}

            {dlState === 'found' && dl && (
              <div className="space-y-3">
                <div className="rounded-xl bg-elevated/60 p-3.5">
                  <p className="truncate text-[12.5px] font-bold" dir="ltr" style={{ textAlign: 'right' }}>{dl.fileName}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    {dl.sizeMB != null && (
                      <span className="rounded-md bg-black/30 px-1.5 py-0.5 font-bold tabular-nums">
                        {dl.sizeMB.toLocaleString('fa-IR')} مگابایت
                      </span>
                    )}
                    {dl.year && <span>{dl.year}</span>}
                  </div>
                </div>
                <a
                  href={dl.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  دانلود مستقیم (MP4)
                </a>
                <p className="text-[10px] leading-5 text-muted-foreground">
                  این فایل از <span className="font-bold text-foreground/80">Archive.org</span> (آرشیو اینترنت) و با توزیع آزاد/مالکیت عمومی ارائه می‌شود. بسته به حجم فایل و سرعت اینترنت، دانلود ممکن است طول بکشد.
                </p>
              </div>
            )}

            {dlState === 'none' && (
              <div className="space-y-4 py-2 text-center">
                <p className="text-[13px] font-bold">فایل مستقیم قانونی برای این عنوان یافت نشد</p>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  اما می‌توانید همین حالا این {type === 'series' ? 'سریال' : 'فیلم'} را از طریق سرورهای پخش تماشا کنید.
                </p>
                <button
                  onClick={() => {
                    setDlOpen(false)
                    play()
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
                >
                  <Play className="h-4 w-4 fill-primary-foreground" aria-hidden />
                  باز کردن پخش‌کننده
                </button>
              </div>
            )}

            {dlState === 'network' && (
              <div className="space-y-4 py-2 text-center">
                <p className="text-[13px] font-bold">دسترسی به آرشیو اینترنت برقرار نشد</p>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  اتصال اینترنت را بررسی کنید یا از پخش آنلاین استفاده کنید.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={openDownload}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden /> تلاش مجدد
                  </button>
                  <button
                    onClick={() => {
                      setDlOpen(false)
                      play()
                    }}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-elevated text-[12.5px] font-semibold"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> پخش آنلاین
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ————————————————————————— subcomponents —————————————————————————

function ActionButton({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-10 items-center justify-center gap-1.5 rounded-xl text-[11.5px] font-semibold transition-all active:scale-95',
        active ? 'bg-primary/12 text-primary ring-1 ring-primary/30' : 'bg-elevated text-foreground/85 hover:bg-elevated/70'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function EpisodeRow({ ep, watched, onPlay }: { ep: EpisodeDTO; watched: HistoryItemDTO | undefined; onPlay: () => void }) {
  const [thumbErr, setThumbErr] = useState(false)
  const air = airDateFa(ep.released)
  return (
    <div className="flex items-center gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0">
      <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-lg bg-elevated">
        {ep.thumb && !thumbErr ? (
          <img
            src={ep.thumb}
            alt={`قسمت ${ep.number}`}
            loading="lazy"
            decoding="async"
            onError={() => setThumbErr(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-tl from-elevated to-card text-[18px] font-black text-muted-foreground/50 tabular-nums">
            {ep.number}
          </div>
        )}
        {watched?.completed && (
          <span className="absolute bottom-1 right-1 rounded bg-primary px-1 py-px text-[8.5px] font-bold text-primary-foreground">دیده‌شده</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-foreground/95">
          <span className="ml-1 text-muted-foreground tabular-nums">{ep.number}.</span> {ep.name}
        </p>
        {ep.overview && <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-muted-foreground">{ep.overview}</p>}
        <div className="mt-1 flex items-center gap-2">
          {air && <span className="text-[9.5px] text-muted-foreground/70 tabular-nums">{air}</span>}
          {watched && !watched.completed && watched.percent > 0 && (
            <span className="flex h-1 w-16 overflow-hidden rounded-full bg-white/10" aria-label={`${watched.percent} درصد دیده‌شده`}>
              <span className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, watched.percent)}%` }} />
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onPlay}
        aria-label={`پخش قسمت ${ep.number}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-90"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
      </button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="h-full overflow-hidden">
      <Skeleton className="h-56 w-full rounded-none bg-elevated" />
      <div className="relative -mt-14 px-4">
        <div className="flex gap-3.5">
          <Skeleton className="h-[156px] w-[104px] rounded-xl bg-elevated" />
          <div className="flex-1 space-y-2.5 pt-2">
            <Skeleton className="h-4 w-24 rounded bg-elevated" />
            <Skeleton className="h-5 w-4/5 rounded bg-elevated" />
            <Skeleton className="h-3.5 w-3/5 rounded bg-elevated" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full bg-elevated" />
              <Skeleton className="h-5 w-14 rounded-full bg-elevated" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-6 h-11 w-full rounded-xl bg-elevated" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Skeleton className="h-10 rounded-xl bg-elevated" />
          <Skeleton className="h-10 rounded-xl bg-elevated" />
          <Skeleton className="h-10 rounded-xl bg-elevated" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-4 w-28 rounded bg-elevated" />
          <Skeleton className="h-3.5 w-full rounded bg-elevated" />
          <Skeleton className="h-3.5 w-11/12 rounded bg-elevated" />
          <Skeleton className="h-3.5 w-4/5 rounded bg-elevated" />
        </div>
      </div>
    </div>
  )
}
