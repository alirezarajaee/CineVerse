'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, Play } from 'lucide-react'
import { api } from '@/lib/api'
import { useNav, usePlayer, useApp } from '@/lib/store'
import { SectionHeader } from '../SectionHeader'
import { PosterCard } from '../PosterCard'
import { PosterImg } from '../PosterImg'
import { PosterRowSkeleton, ErrorState, EmptyState } from '../States'
import { genreFa } from '@/lib/providers/metadata'
import type { HistoryItemDTO, MediaCard } from '@/lib/types'

/* ——————————————————— Hero rotator ——————————————————— */

function LogoImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <h1 className="text-glow text-[26px] font-black leading-tight">{alt}</h1>
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="max-h-24 w-auto max-w-[75%] object-contain drop-shadow-lg"
    />
  )
}

function HeroLogo({ src, title }: { src: string | null; title: string }) {
  if (!src) {
    return <h1 className="text-glow text-[26px] font-black leading-tight">{title}</h1>
  }
  return (
    <div className="flex min-h-[44px] items-end">
      <LogoImg key={src} src={src} alt={title} />
    </div>
  )
}

function HeroRotator({ items }: { items: MediaCard[] }) {
  const { push } = useNav()
  const openPlayer = usePlayer((s) => s.openPlayer)
  const [idx, setIdx] = useState(0)
  const count = items.length

  useEffect(() => {
    if (count < 2) return
    const id = window.setInterval(() => setIdx((idx + 1) % count), 7000)
    return () => window.clearInterval(id)
  }, [count, idx])

  if (count === 0) return null
  const hero = items[Math.min(idx, count - 1)]

  const play = () => {
    if (hero.type === 'movie') {
      openPlayer({ imdbId: hero.imdbId, type: 'movie', title: hero.title, poster: hero.poster, year: hero.year })
    } else {
      push({ name: 'detail', imdbId: hero.imdbId, type: 'series' })
    }
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={hero.imdbId}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <PosterImg src={hero.background ?? hero.poster} alt={hero.title} eager className="h-full w-full" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 cine-gradient-b" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" aria-hidden />

      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5">
        <motion.div key={hero.imdbId + '-txt'} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <HeroLogo src={hero.logo} title={hero.title} />
          <p className="mt-2 text-[11.5px] text-muted-foreground" dir="rtl">
            <span className="tabular-nums">{hero.year ?? '—'}</span>
            {hero.rating != null && hero.rating > 0 && (
              <> • <span className="font-bold text-[#f5c518] tabular-nums">★ {hero.rating.toFixed(1)}</span></>
            )}
            {hero.genres.length > 0 && (
              <> • <span className="text-foreground/70">{hero.genres.slice(0, 3).map(genreFa).join(' • ')}</span></>
            )}
          </p>
          {hero.description && (
            <p className="mt-1.5 line-clamp-2 max-w-[92%] text-[11.5px] leading-5 text-muted-foreground/90">{hero.description}</p>
          )}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={play}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[13.5px] font-bold text-primary-foreground shadow-[0_6px_24px_rgba(229,9,20,0.45)] transition-transform active:scale-95"
            >
              <Play className="h-4 w-4 fill-primary-foreground" aria-hidden /> پخش
            </button>
            <button
              onClick={() => push({ name: 'detail', imdbId: hero.imdbId, type: hero.type })}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-5 py-2.5 text-[13.5px] font-bold text-foreground backdrop-blur transition-transform active:scale-95"
            >
              <Info className="h-4 w-4" aria-hidden /> جزئیات
            </button>
          </div>
        </motion.div>
        {count > 1 && (
          <div className="mt-4 flex justify-center gap-1.5" role="tablist" aria-label="انتخاب اسلاید" dir="ltr">
            {items.map((it, i) => (
              <button
                key={it.imdbId}
                onClick={() => setIdx(i)}
                aria-label={`اسلاید ${i + 1}`}
                className={`h-1 rounded-full transition-all ${i === idx ? 'w-5 bg-primary' : 'w-1.5 bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ——————————————————— Continue-watching rail ——————————————————— */

function resumePayload(h: HistoryItemDTO) {
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

function ContinueRail() {
  const { push } = useNav()
  const openPlayer = usePlayer((s) => s.openPlayer)
  const q = useQuery({ queryKey: ['continue'], queryFn: api.continueWatching, staleTime: 30_000 })
  const items = q.data ?? []
  if (q.isPending || q.isError || items.length === 0) return null

  return (
    <section className="mt-5 space-y-3">
      <SectionHeader title="ادامه تماشا" onMore={() => push({ name: 'continue' })} />
      <div className="flex snap-x gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
        {items.map((h) => (
          <div key={h.id} className="w-[124px] shrink-0 snap-start text-right sm:w-[132px]">
            <button
              type="button"
              onClick={() => openPlayer(resumePayload(h))}
              className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl poster-shadow transition-transform duration-300 group-active:scale-95"
              aria-label={`ادامه پخش ${h.title}`}
            >
              <PosterImg src={h.poster} alt={h.title} className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" aria-hidden />
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-white/90">
                {h.percent}%
              </span>
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/90 shadow-lg shadow-primary/30 transition-transform group-active:scale-90">
                <Play className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" aria-hidden />
              </span>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                <div className={`h-full ${h.completed ? 'bg-[#46d369]' : 'bg-primary'}`} style={{ width: `${Math.min(100, h.percent)}%` }} />
              </div>
            </button>
            <p className="mt-2 line-clamp-1 text-[11.5px] font-semibold text-foreground/90">{h.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {h.season != null && h.episode != null
                ? `فصل ${h.season}، قسمت ${h.episode}`
                : h.completed ? 'تماشا شد' : `${h.percent}% دیده‌شده`}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ——————————————————— Home screen ——————————————————— */

function SkeletonBar() {
  return (
    <div className="px-4">
      <div className="h-4 w-32 animate-pulse rounded bg-elevated" />
    </div>
  )
}

export function HomeScreen() {
  const { push } = useNav()
  const sessionUser = useApp((s) => s.sessionUser)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: api.home,
    staleTime: 5 * 60_000,
  })

  if (isPending) {
    return (
      <div className="h-full overflow-y-auto no-scrollbar pb-24">
        <div className="px-5 pt-6">
          <div className="h-6 w-32 animate-pulse rounded bg-elevated" />
          <div className="mt-2 h-4 w-44 animate-pulse rounded bg-elevated" />
        </div>
        <div className="mt-5 h-[380px] w-full animate-pulse bg-elevated/60" />
        <div className="mt-7 space-y-3">
          <SkeletonBar />
          <PosterRowSkeleton count={5} />
        </div>
        <div className="mt-7 space-y-3">
          <SkeletonBar />
          <PosterRowSkeleton count={5} />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center px-4 pb-16">
        <ErrorState onRetry={() => refetch()} message={error instanceof Error ? error.message : undefined} />
      </div>
    )
  }

  const rails = data.rails.filter((r) => r.items.length > 0)
  const nothing = data.hero.length === 0 && rails.length === 0
  if (nothing) {
    return (
      <div className="flex h-full items-center justify-center px-4 pb-16">
        <EmptyState
          title="فعلاً چیزی برای نمایش نیست"
          subtitle="سرویس اطلاعات فیلم و سریال موقتاً در دسترس نیست؛ کمی بعد دوباره امتحان کنید."
        />
      </div>
    )
  }

  const firstName = sessionUser?.name?.trim()

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-24">
      {/* Greeting — BottomNav handles navigation, no top navbar */}
      <header className="px-5 pb-1 pt-5">
        <h1 className="truncate text-[20px] font-black">
          {firstName ? `سلام، ${firstName} 👋` : 'سلام 👋'}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">دنبال چی می‌گردی؟</p>
      </header>

      {data.hero.length > 0 && (
        <div className="mt-3">
          <HeroRotator items={data.hero.slice(0, 5)} />
        </div>
      )}

      <ContinueRail />

      {rails.map((rail) => (
        <section key={rail.key} className="mt-7 space-y-3">
          <SectionHeader
            title={rail.titleFa}
            onMore={() =>
              push({
                name: 'catalog',
                type: rail.type,
                catalog: rail.catalog,
                genre: rail.genre ?? undefined,
                label: rail.titleFa,
              })
            }
          />
          <div className="flex snap-x gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {rail.items.map((m, i) => (
              <PosterCard
                key={m.imdbId}
                item={m}
                eager={i < 4}
                onClick={() => push({ name: 'detail', imdbId: m.imdbId, type: m.type })}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-10 text-center text-[9.5px] leading-5 text-muted-foreground/40">
        اطلاعات آثار از دیتابیس عمومی IMDb دریافت می‌شود
      </p>
    </div>
  )
}
