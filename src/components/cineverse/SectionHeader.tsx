'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  onMore?: () => void
  className?: string
  moreLabel?: string
}

export function SectionHeader({ title, onMore, className, moreLabel }: Props) {
  return (
    <div className={cn('flex items-center justify-between px-4', className)}>
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {onMore && (
        <button
          onClick={onMore}
          className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`مشاهده همه ${title}`}
        >
          <span>{moreLabel ?? 'همه'}</span>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
