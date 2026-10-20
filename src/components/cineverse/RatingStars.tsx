'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RatingStars({ rating, className }: { rating: number | null; className?: string }) {
  const r = rating ?? 0
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`امتیاز ${r} از ۱۰`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = r / 2 >= i + 0.75
        const half = !filled && r / 2 >= i + 0.25
        return (
          <Star
            key={i}
            className={cn('h-3.5 w-3.5', filled ? 'fill-[#f5c518] text-[#f5c518]' : half ? 'fill-[#f5c518]/50 text-[#f5c518]' : 'fill-none text-muted-foreground/50')}
          />
        )
      })}
    </div>
  )
}
