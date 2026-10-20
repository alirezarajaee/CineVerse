'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, WifiOff, RefreshCw, Inbox } from 'lucide-react'

export function PosterRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[118px] shrink-0 space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl bg-elevated" />
          <Skeleton className="h-3 w-4/5 rounded bg-elevated" />
          <Skeleton className="h-2.5 w-2/5 rounded bg-elevated" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-[86px] w-[60px] rounded-lg bg-elevated" />
          <div className="flex-1 space-y-2 py-1.5">
            <Skeleton className="h-3.5 w-3/5 rounded bg-elevated" />
            <Skeleton className="h-3 w-2/5 rounded bg-elevated" />
            <Skeleton className="h-2 w-1/4 rounded bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated">
        <AlertTriangle className="h-6 w-6 text-[#e87c03]" aria-hidden />
      </div>
      <p className="text-sm font-semibold">{message ?? 'خطا در دریافت اطلاعات'}</p>
      <p className="text-xs leading-5 text-muted-foreground">دوباره تلاش کنید؛ اگر مشکل ادامه داشت اتصال اینترنت را بررسی کنید.</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-1 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform active:scale-95">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> تلاش مجدد
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: 'inbox' | 'offline' }) {
  const Icon = icon === 'offline' ? WifiOff : Inbox
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {subtitle && <p className="max-w-[240px] text-xs leading-5 text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
