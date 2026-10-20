'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Search as SearchIcon, Trash2, X } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useNav } from '@/lib/store'
import { PosterCard } from '../PosterCard'
import { EmptyState, ErrorState } from '../States'
import { cn } from '@/lib/utils'

const TYPE_CHIPS = [
  { id: 'all', label: 'همه' },
  { id: 'movie', label: 'فیلم' },
  { id: 'series', label: 'سریال' },
] as const
type TypeChip = (typeof TYPE_CHIPS)[number]['id']

const POPULAR_QUERIES = [
  'اینترستلار',
  'Breaking Bad',
  'انیمیشن',
  'اکشن',
  'Stranger Things',
  'کمدی',
  'Game of Thrones',
  'درام',
  'Oppenheimer',
  'جنایی',
]

const PAGE = 100

function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl bg-elevated" />
          <Skeleton className="h-3 w-4/5 rounded bg-elevated" />
          <Skeleton className="h-2.5 w-2/5 rounded bg-elevated" />
        </div>
      ))}
    </div>
  )
}

export function SearchScreen() {
  const { push } = useNav()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeChip>('all')
  const [confirmClear, setConfirmClear] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recordedRef = useRef('')

  // Debounce the query (400ms)
  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 400)
    return () => window.clearTimeout(t)
  }, [input])

  const active = q.length >= 2

  const search = useInfiniteQuery({
    queryKey: ['search', q, type],
    queryFn: ({ pageParam }) => api.search({ q, type, skip: pageParam }),
    enabled: active,
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length * PAGE : undefined),
    staleTime: 60_000,
  })

  const history = useQuery({
    queryKey: ['search-history'],
    queryFn: api.searchHistory,
    enabled: !active,
    staleTime: 30_000,
  })

  // Record the query once per successful search
  useEffect(() => {
    if (!search.isSuccess || !search.data) return
    if (recordedRef.current === q) return
    recordedRef.current = q
    api
      .recordSearch(q)
      .then(() => qc.invalidateQueries({ queryKey: ['search-history'] }))
      .catch(() => undefined)
  }, [search.isSuccess, search.data, q, qc])

  const clearHistory = useMutation({
    mutationFn: api.clearSearchHistory,
    onSuccess: () => {
      setConfirmClear(false)
      qc.invalidateQueries({ queryKey: ['search-history'] })
      toast.success('تاریخچه جست‌وجو پاک شد')
    },
    onError: () => toast.error('پاک‌کردن تاریخچه ناموفق بود'),
  })

  const items = search.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Search bar + type chips */}
      <div className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md">
        <div className="relative">
          <SearchIcon className="absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQ(input.trim())
                inputRef.current?.blur()
              }
            }}
            placeholder="جست‌وجوی فیلم و سریال…"
            aria-label="جست‌وجو در فیلم و سریال"
            className="w-full rounded-2xl border border-border bg-elevated/70 py-3 pl-10 pr-11 text-[13.5px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
          />
          {input && (
            <button
              onClick={() => {
                setInput('')
                setQ('')
                inputRef.current?.focus()
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="پاک کردن جست‌وجو"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="نوع محتوا">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => setType(c.id)}
              role="tab"
              aria-selected={type === c.id}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-[11.5px] font-semibold transition-colors',
                type === c.id ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {!active ? (
          <div className="space-y-6 px-4 pt-4">
            {history.isSuccess && (history.data?.length ?? 0) > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-bold">تاریخچه جست‌وجو</h2>
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                    aria-label="پاک کردن تاریخچه جست‌وجو"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> پاک‌کردن
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.data!.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setInput(h.query)}
                      className="flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-[11.5px] text-foreground/90 transition-colors hover:bg-primary/15"
                    >
                      <Clock className="h-3 w-3 text-muted-foreground" aria-hidden />
                      {h.query}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-2 text-[13px] font-bold">جستجوهای پرطرفدار</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_QUERIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border/70 px-3 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
            <p className="pt-2 text-center text-[11px] text-muted-foreground/70">
              برای شروع، دست‌کم دو حرف بنویسید یا یکی از پیشنهادها را لمس کنید.
            </p>
          </div>
        ) : search.isPending ? (
          <div className="px-4 pt-4">
            <GridSkeleton count={10} />
          </div>
        ) : search.isError ? (
          <ErrorState onRetry={() => search.refetch()} message={search.error instanceof Error ? search.error.message : undefined} />
        ) : items.length === 0 ? (
          <EmptyState title="نتیجه‌ای یافت نشد" subtitle="املای عبارت را بررسی کنید یا با تغییر فیلتر «فیلم/سریال» دوباره تلاش کنید." />
        ) : (
          <div className="px-4 pt-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {items.map((m) => (
                <PosterCard
                  key={m.imdbId}
                  item={m}
                  className="w-full"
                  onClick={() => push({ name: 'detail', imdbId: m.imdbId, type: m.type })}
                />
              ))}
            </div>
            {search.hasNextPage && (
              <button
                onClick={() => search.fetchNextPage()}
                disabled={search.isFetchingNextPage}
                className="mx-auto mt-6 block rounded-full border border-border px-6 py-2.5 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-elevated disabled:opacity-50"
              >
                {search.isFetchingNextPage ? 'در حال بارگذاری…' : 'بارگذاری بیشتر'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm clearing search history */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>پاک‌کردن تاریخچه جست‌وجو؟</AlertDialogTitle>
            <AlertDialogDescription>همه عبارت‌هایی که جست‌وجو کرده‌اید حذف می‌شوند؛ این عمل قابل بازگشت نیست.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2 sm:justify-start">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearHistory.mutate()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              پاک‌کردن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
