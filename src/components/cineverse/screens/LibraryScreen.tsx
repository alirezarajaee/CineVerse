'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Play, X } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type LibrarySnapshot } from '@/lib/api'
import type { HistoryItemDTO, LibraryItem, LibraryItemDTO, PlayerPayload } from '@/lib/types'
import { useNav, usePlayer } from '@/lib/store'
import { PosterImg } from '../PosterImg'
import { EmptyState, ErrorState, ListSkeleton } from '../States'
import { fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const TYPE_FA: Record<LibraryItemDTO['type'], string> = { movie: 'فیلم', series: 'سریال' }

/** Resume payload for a history/continue entry. */
function resumePayload(h: HistoryItemDTO): PlayerPayload {
  return {
    imdbId: h.imdbId,
    type: h.type,
    title: h.title,
    poster: h.poster,
    year: h.year,
    season: h.season,
    episode: h.episode,
    episodeName: h.episodeTitle,
    ...(h.percent > 0 && !h.completed ? { startAt: h.positionSec } : {}),
  }
}

function episodeLabel(h: HistoryItemDTO): string {
  if (h.season != null && h.episode != null) {
    return h.episodeTitle ? `فصل ${h.season}، قسمت ${h.episode} — ${h.episodeTitle}` : `فصل ${h.season}، قسمت ${h.episode}`
  }
  return TYPE_FA[h.type] + (h.year ? ` • ${h.year}` : '')
}

/* ————— Row: favorites / watchlist ————— */

function ListRow({
  it,
  onRemove,
  removeLabel,
}: {
  it: LibraryItem
  onRemove: (snap: LibrarySnapshot) => void
  removeLabel: string
}) {
  const { push } = useNav()
  const m = it.item
  const snap: LibrarySnapshot = { imdbId: m.imdbId, type: m.type, title: m.title, poster: m.poster, year: m.year, rating: m.rating }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card/60 p-2 transition-colors hover:bg-card">
      <button onClick={() => push({ name: 'detail', imdbId: m.imdbId, type: m.type })} className="shrink-0" aria-label={`مشاهده ${m.title}`}>
        <PosterImg src={m.poster} alt={m.title} className="h-[84px] w-[58px] rounded-lg" />
      </button>
      <button onClick={() => push({ name: 'detail', imdbId: m.imdbId, type: m.type })} className="min-w-0 flex-1 text-right">
        <p className="truncate text-[13px] font-bold">{m.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {TYPE_FA[m.type]} • <span className="tabular-nums">{m.year ?? '—'}</span>
        </p>
        {m.rating != null && m.rating > 0 && (
          <p className="mt-0.5 text-[11px] font-bold text-[#f5c518] tabular-nums">★ {m.rating.toFixed(1)}</p>
        )}
      </button>
      <button
        onClick={() => onRemove(snap)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted-foreground transition-transform active:scale-90 hover:text-primary"
        aria-label={removeLabel}
        title={removeLabel}
      >
        <X className="h-4.5 w-4.5" aria-hidden />
      </button>
    </div>
  )
}

/* ————— Row: continue / history ————— */

function WatchRow({ h, resumeLabel }: { h: HistoryItemDTO; resumeLabel: string }) {
  const openPlayer = usePlayer((s) => s.openPlayer)
  return (
    <button
      type="button"
      onClick={() => openPlayer(resumePayload(h))}
      className="flex w-full items-center gap-3 rounded-2xl bg-card/60 p-2 text-right transition-colors hover:bg-card"
      aria-label={`${resumeLabel} ${h.title}`}
    >
      <PosterImg src={h.poster} alt={h.title} className="h-[84px] w-[58px] shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{h.title}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{episodeLabel(h)}</span>
        <span className="mt-1.5 block h-1 w-full rounded bg-white/10">
          <span className={cn('block h-full rounded', h.completed ? 'bg-[#46d369]' : 'bg-primary')} style={{ width: `${Math.min(100, h.percent)}%` }} />
        </span>
        <span className="mt-1 block text-[9.5px] text-muted-foreground tabular-nums">
          {h.completed
            ? 'تماشا شد ✓'
            : h.durationSec > 0
              ? `${fmtTime(h.positionSec)} / ${fmtTime(h.durationSec)} — ${h.percent}%`
              : `${h.percent}%`}
          {' • '}
          {new Date(h.updatedAt).toLocaleDateString('fa-IR')}
        </span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25">
        <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" aria-hidden />
      </span>
    </button>
  )
}

/* ————— Panels ————— */

function ListPanel({
  queryKey,
  fetcher,
  emptyTitle,
  emptySubtitle,
  removeLabel,
  toggle,
  removedToast,
}: {
  queryKey: string[]
  fetcher: () => Promise<LibraryItem[]>
  emptyTitle: string
  emptySubtitle: string
  removeLabel: string
  toggle: (snap: LibrarySnapshot) => Promise<{ favorite?: boolean; watchlist?: boolean }>
  removedToast: string
}) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey, queryFn: fetcher })
  const remove = useMutation({
    mutationFn: toggle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success(removedToast)
    },
    onError: () => toast.error('حذف ناموفق بود؛ دوباره تلاش کنید'),
  })

  if (q.isPending) return <ListSkeleton count={5} />
  if (q.isError) return <ErrorState onRetry={q.refetch} />
  const items = q.data ?? []
  if (items.length === 0) return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />

  return (
    <div className="thin-scrollbar max-h-96 overflow-y-auto pl-1">
      <div className="space-y-1.5">
        {items.map((it) => (
          <ListRow key={it.item.imdbId} it={it} onRemove={(snap) => remove.mutate(snap)} removeLabel={removeLabel} />
        ))}
      </div>
    </div>
  )
}

function WatchPanel({ mode }: { mode: 'continue' | 'history' }) {
  const isContinue = mode === 'continue'
  const q = useQuery({ queryKey: [mode], queryFn: isContinue ? api.continueWatching : api.history })

  if (q.isPending) return <ListSkeleton count={5} />
  if (q.isError) return <ErrorState onRetry={q.refetch} />
  const items = q.data ?? []
  if (items.length === 0) {
    return isContinue ? (
      <EmptyState title="هنوز چیزی نیمه‌تمام ندارید" subtitle="وقتی اثری را تماشا کنید، از همان‌جا ادامه می‌دهید." />
    ) : (
      <EmptyState title="تاریخچه شما خالی است" subtitle="آثاری که تماشا می‌کنید اینجا ثبت می‌شوند." />
    )
  }
  return (
    <div className="thin-scrollbar max-h-96 overflow-y-auto pl-1">
      <div className="space-y-1.5">
        {items.map((h) => (
          <WatchRow key={h.id} h={h} resumeLabel={h.completed ? 'تماشای دوباره' : 'ادامه پخش'} />
        ))}
      </div>
    </div>
  )
}

/* ————— Screen ————— */

const TABS = [
  { id: 'favorites', label: 'علاقه‌مندی' },
  { id: 'watchlist', label: 'واچ‌لیست' },
  { id: 'continue', label: 'ادامه تماشا' },
  { id: 'history', label: 'تاریخچه' },
] as const

export function LibraryScreen() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/60 px-4 pb-2 pt-4">
        <h1 className="text-[17px] font-black">کتابخانه</h1>
      </header>

      <Tabs defaultValue="favorites" className="min-h-0 flex-1">
        <div className="border-b border-border/60 px-4 pt-1">
          <TabsList className="grid h-9 w-full grid-cols-4 bg-elevated/60">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="relative text-[11.5px]">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="favorites" className="min-h-0 px-4 pt-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <ListPanel
              queryKey={['favorites']}
              fetcher={api.favorites}
              emptyTitle="لیست شما خالی است"
              emptySubtitle="با لمس ♥ در صفحه جزئیات، آثار موردعلاقه‌تان را اینجا جمع کنید."
              removeLabel="حذف از علاقه‌مندی‌ها"
              toggle={api.toggleFavorite}
              removedToast="از علاقه‌مندی‌ها حذف شد"
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="watchlist" className="min-h-0 px-4 pt-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <ListPanel
              queryKey={['watchlist']}
              fetcher={api.watchlist}
              emptyTitle="واچ‌لیست شما خالی است"
              emptySubtitle="آثاری که می‌خواهید بعداً ببینید را با + در صفحه جزئیات ذخیره کنید."
              removeLabel="حذف از واچ‌لیست"
              toggle={api.toggleWatchlist}
              removedToast="از واچ‌لیست حذف شد"
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="continue" className="min-h-0 px-4 pt-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <WatchPanel mode="continue" />
          </motion.div>
        </TabsContent>

        <TabsContent value="history" className="min-h-0 px-4 pt-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <WatchPanel mode="history" />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
