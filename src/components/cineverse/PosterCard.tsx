'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaCard, MType } from '@/lib/types'
import { PosterImg } from './PosterImg'

const TYPE_FA: Record<MType, string> = { movie: 'فیلم', series: 'سریال' }

interface Props {
  item: MediaCard
  onClick?: () => void
  className?: string
  eager?: boolean
}

/** Vertical poster card for the live IMDb-backed catalog. */
export function PosterCard({ item, onClick, className, eager }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group w-28 shrink-0 snap-start text-right focus:outline-none sm:w-32', className)}
      aria-label={`${item.title}${item.year ? ` (${item.year})` : ''} — ${TYPE_FA[item.type]}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl poster-shadow transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95">
        <PosterImg src={item.poster} alt={item.title} eager={eager} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        {item.rating != null && item.rating > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-[#f5c518] backdrop-blur-sm tabular-nums">
            <Star className="h-2.5 w-2.5 fill-[#f5c518]" aria-hidden />
            {item.rating.toFixed(1)}
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
          {TYPE_FA[item.type]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.4em] text-[12px] font-semibold leading-[1.2] text-foreground/90">{item.title}</p>
      <p className="truncate text-[10.5px] text-muted-foreground tabular-nums">{item.year ?? ''}</p>
    </button>
  )
}
