'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { useNav, usePlayer } from '@/lib/store'
import { PosterImg } from '../PosterImg'
import { EmptyState, ErrorState, ListSkeleton } from '../States'
import { fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HistoryItemDTO, PlayerPayload } from '@/lib/types'

const TYPE_FA = { movie: 'فیلم', series: 'سریال' } as const

/** Player payload for a history entry — resumes mid-way unless completed. */
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

function seLabel(h: HistoryItemDTO): string {
  if (h.season != null && h.episode != null) {
    return h.episodeTitle ? `فصل ${h.season}، قسمت ${h.episode} — ${h.episodeTitle}` : `فصل ${h.season}، قسمت ${h.episode}`
  }
  return TYPE_FA[h.type]
}

/* ————— Shared row ————— */

function HistoryRow({ h }: { h: HistoryItemDTO }) {
  const { push } = useNav()
  const openPlayer = usePlayer((s) => s.openPlayer)
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card/60 p-2 transition-colors hover:bg-card">
      <button onClick={() => push({ name: 'detail', imdbId: h.imdbId, type: h.type })} className="shrink-0" aria-label={`مشاهده ${h.title}`}>
        <PosterImg src={h.poster} alt={h.title} className="h-[84px] w-[58px] rounded-lg" />
      </button>
      <button onClick={() => push({ name: 'detail', imdbId: h.imdbId, type: h.type })} className="min-w-0 flex-1 text-right">
        <p className="truncate text-[13px] font-bold">{h.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">{seLabel(h)}</p>
        <div className="mt-1.5 h-1 w-full rounded bg-white/10">
          <div className={cn('h-full rounded', h.completed ? 'bg-[#46d369]' : 'bg-primary')} style={{ width: `${Math.min(100, h.percent)}%` }} />
        </div>
        <p className="mt-1 text-[9.5px] text-muted-foreground tabular-nums">
          {h.completed
            ? 'تماشا شد ✓'
            : h.durationSec > 0
              ? `${fmtTime(h.positionSec)} / ${fmtTime(h.durationSec)} — ${h.percent}%`
              : `${h.percent}%`}
          {' • '}
          {new Date(h.updatedAt).toLocaleDateString('fa-IR')}
        </p>
      </button>
      <button
        onClick={() => openPlayer(resumePayload(h))}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90',
          h.completed ? 'bg-elevated text-foreground' : 'bg-primary shadow-lg shadow-primary/25'
        )}
        aria-label={h.completed ? `تماشای دوباره ${h.title}` : `ادامه پخش ${h.title}`}
        title={h.completed ? 'تماشای دوباره' : 'ادامه پخش'}
      >
        <Play className={cn('h-4 w-4', h.completed ? 'fill-foreground' : 'fill-primary-foreground text-primary-foreground')} aria-hidden />
      </button>
    </div>
  )
}

/* ————— History screen (stack) ————— */

export function HistoryScreen() {
  const { pop } = useNav()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['history'], queryFn: api.history })
  const [confirmClear, setConfirmClear] = useState(false)

  const clear = useMutation({
    mutationFn: api.clearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['continue'] })
      setConfirmClear(false)
      toast.success('تاریخچه تماشا پاک شد')
    },
    onError: () => toast.error('پاک‌کردن تاریخچه ناموفق بود'),
  })

  const items = q.data ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-3.5">
        <div className="flex items-center gap-2">
          <button onClick={pop} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-card" aria-label="بازگشت">
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-[16px] font-black">تاریخچه تماشا</h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
            aria-label="پاک‌کردن کل تاریخچه"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> پاک‌کردن همه
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-3">
        {q.isPending ? (
          <ListSkeleton count={6} />
        ) : q.isError ? (
          <ErrorState onRetry={q.refetch} />
        ) : items.length === 0 ? (
          <EmptyState title="تاریخچه خالی است" subtitle="آثاری که تماشا می‌کنید اینجا ثبت می‌شوند تا هر وقت خواستید ادامه دهید." />
        ) : (
          <div className="space-y-1.5">
            {items.map((h) => (
              <HistoryRow key={h.id} h={h} />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>پاک‌کردن کل تاریخچه تماشا؟</AlertDialogTitle>
            <AlertDialogDescription>
              همه پیشرفت‌ها و رکوردهای تماشا حذف می‌شوند و «ادامه تماشا» خالی می‌شود؛ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2 sm:justify-start">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={() => clear.mutate()} className="bg-destructive text-white hover:bg-destructive/90">
              پاک‌کردن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ————— Continue-watching screen (stack) ————— */

export function ContinueScreen() {
  const { pop, push } = useNav()
  const q = useQuery({ queryKey: ['continue'], queryFn: api.continueWatching })
  const items = q.data ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3.5">
        <button onClick={pop} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-card" aria-label="بازگشت">
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="text-[16px] font-black">ادامه تماشا</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-3">
        {q.isPending ? (
          <ListSkeleton count={5} />
        ) : q.isError ? (
          <ErrorState onRetry={q.refetch} />
        ) : items.length === 0 ? (
          <EmptyState title="هنوز چیزی نیمه‌تمام ندارید" subtitle="هر اثری را تماشا کنید، از همان‌جایی که رها کردید ادامه می‌دهید." />
        ) : (
          <div className="space-y-1.5">
            {items.map((h) => (
              <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                <div className="flex items-center gap-3 rounded-2xl bg-card/60 p-2 transition-colors hover:bg-card">
                  <button onClick={() => push({ name: 'detail', imdbId: h.imdbId, type: h.type })} className="shrink-0" aria-label={`مشاهده ${h.title}`}>
                    <PosterImg src={h.poster} alt={h.title} className="h-[84px] w-[58px] rounded-lg" />
                  </button>
                  <button onClick={() => push({ name: 'detail', imdbId: h.imdbId, type: h.type })} className="min-w-0 flex-1 text-right">
                    <p className="truncate text-[13px] font-bold">{h.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{seLabel(h)}</p>
                    <div className="mt-1.5 h-1 w-full rounded bg-white/10">
                      <div className={cn('h-full rounded', h.completed ? 'bg-[#46d369]' : 'bg-primary')} style={{ width: `${Math.min(100, h.percent)}%` }} />
                    </div>
                    <p className="mt-1 text-[9.5px] text-muted-foreground tabular-nums">
                      {h.completed ? 'تماشا شد ✓' : `${h.percent}% باقی‌مانده`} • {new Date(h.updatedAt).toLocaleDateString('fa-IR')}
                    </p>
                  </button>
                  <ResumeButton h={h} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResumeButton({ h }: { h: HistoryItemDTO }) {
  const openPlayer = usePlayer((s) => s.openPlayer)
  return (
    <button
      onClick={() => openPlayer(resumePayload(h))}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25 transition-transform active:scale-90"
      aria-label={`ادامه پخش ${h.title}`}
      title="ادامه پخش"
    >
      <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" aria-hidden />
    </button>
  )
}
