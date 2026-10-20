'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useNav } from '@/lib/store'
import { PosterCard } from '../PosterCard'
import { EmptyState, ErrorState } from '../States'
import { BROWSE_GENRES } from '@/lib/providers/metadata'
import { cn } from '@/lib/utils'
import type { MType } from '@/lib/types'

const PAGE = 100

function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-elevated" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-elevated" />
        </div>
      ))}
    </div>
  )
}

/** Browsable catalog page (پرطرفدارها، بهترین‌ها، تازه‌ها…) with optional genre filter. */
export function CatalogScreen({
  type,
  catalog,
  genre,
  label,
}: {
  type: MType
  catalog: string
  genre?: string
  label: string
}) {
  const { pop, push } = useNav()
  const [genre_, setGenre_] = useState<string | undefined>(genre)

  const q = useInfiniteQuery({
    queryKey: ['catalog', type, catalog, genre_ ?? null],
    queryFn: ({ pageParam }) => api.catalog({ type, catalog, genre: genre_, skip: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length * PAGE : undefined),
    staleTime: 60_000,
  })

  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3.5">
        <button onClick={pop} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-card" aria-label="بازگشت">
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="text-[16px] font-black">{label}</h1>
      </header>

      {/* Genre chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-border/60 px-4 py-2.5" role="tablist" aria-label="ژانر">
        <button
          onClick={() => setGenre_(undefined)}
          aria-pressed={genre_ == null}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-colors',
            genre_ == null ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
          )}
        >
          همه
        </button>
        {BROWSE_GENRES.map((g) => (
          <button
            key={g.en}
            onClick={() => setGenre_(g.en)}
            aria-pressed={genre_ === g.en}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-colors',
              genre_ === g.en ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
            )}
          >
            {g.fa}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-4">
        {q.isPending ? (
          <GridSkeleton count={12} />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} message={q.error instanceof Error ? q.error.message : undefined} />
        ) : items.length === 0 ? (
          <EmptyState title="عنوانی یافت نشد" subtitle="این دسته یا ژانر فعلاً نتیجه‌ای ندارد؛ ژانر دیگری را امتحان کنید." />
        ) : (
          <>
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
            {q.hasNextPage && (
              <button
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="mx-auto mt-6 block rounded-full border border-border px-6 py-2.5 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-elevated disabled:opacity-50"
              >
                {q.isFetchingNextPage ? 'در حال بارگذاری…' : 'بیشتر'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
