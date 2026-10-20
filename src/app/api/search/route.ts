import { searchMetas, metaToCard, type MType } from '@/lib/providers/metadata'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Live search across the full movie/series database (IMDb-backed).
 * type=all merges movie + series results (interleaved).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const type = (url.searchParams.get('type') ?? 'all') as 'all' | MType
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? '0') || 0)

  if (!q) return ok({ items: [], page: 0, hasMore: false })
  if (q.length < 2) return ok({ items: [], page: 0, hasMore: false })

  try {
    if (type === 'all') {
      const [movies, series] = await Promise.all([
        searchMetas('movie', q, skip).catch(() => []),
        searchMetas('series', q, skip).catch(() => []),
      ])
      // interleave: m0, s0, m1, s1...
      const items: ReturnType<typeof metaToCard>[] = []
      const n = Math.max(movies.length, series.length)
      for (let i = 0; i < n; i++) {
        if (movies[i]) items.push(metaToCard(movies[i]))
        if (series[i]) items.push(metaToCard(series[i]))
      }
      return ok({ items, page: Math.floor(skip / 100) + 1, hasMore: movies.length >= 100 || series.length >= 100 })
    }

    const metas = await searchMetas(type as MType, q, skip)
    return ok({ items: metas.map(metaToCard), page: Math.floor(skip / 100) + 1, hasMore: metas.length >= 100 })
  } catch (err) {
    console.error('[api/search]', err)
    return ok({ error: 'UPSTREAM_ERROR', message: 'جستجو موقتاً در دسترس نیست. چند لحظه بعد تلاش کنید.' }, 502)
  }
}
