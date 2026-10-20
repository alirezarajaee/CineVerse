import { getCatalog, getMeta, metaToCard, type RawMeta } from '@/lib/providers/metadata'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Home feed from the LIVE movie/series database.
 * Each rail resolves independently (allSettled) so one flaky upstream call
 * can never take the whole page down; upstream results are cached 10 min.
 */
export async function GET() {
  const results = await Promise.allSettled([
    getCatalog('movie', 'top'),
    getCatalog('series', 'top'),
    getCatalog('movie', 'imdbRating'),
    getCatalog('series', 'imdbRating'),
    getCatalog('movie', 'year'),
    getCatalog('movie', 'top', { genre: 'Animation' }),
  ])
  const [movieTop, seriesTop, movieRating, seriesRating, movieNew, animations] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : ([] as RawMeta[]),
  )

  const toItems = (metas: RawMeta[], n: number) => metas.slice(0, n).map(metaToCard)

  // Hero: top 5 trending movies, enriched with full meta (logo/background/description)
  const heroMetas = movieTop.filter((m) => m.poster).slice(0, 5)
  const heroCards = (
    await Promise.allSettled(
      heroMetas.map(async (m) => metaToCard(await getMeta('movie', m.id))),
    )
  )
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof metaToCard>> => r.status === 'fulfilled')
    .map((r) => r.value)

  const rails = [
    { key: 'trending-movies', titleFa: 'پرطرفدارترین فیلم‌ها', type: 'movie' as const, catalog: 'top', genre: null, metas: movieTop },
    { key: 'trending-series', titleFa: 'سریال‌های داغ', type: 'series' as const, catalog: 'top', genre: null, metas: seriesTop },
    { key: 'best-movies', titleFa: 'بهترین فیلم‌های IMDb', type: 'movie' as const, catalog: 'imdbRating', genre: null, metas: movieRating },
    { key: 'best-series', titleFa: 'بهترین سریال‌های تاریخ', type: 'series' as const, catalog: 'imdbRating', genre: null, metas: seriesRating },
    { key: 'fresh-movies', titleFa: 'تازه‌های سینما', type: 'movie' as const, catalog: 'year', genre: null, metas: movieNew },
    { key: 'animation', titleFa: 'انیمیشن', type: 'movie' as const, catalog: 'top', genre: 'Animation', metas: animations },
  ]
    .filter((r) => r.metas.length > 0)
    .map((r) => ({
      key: r.key,
      titleFa: r.titleFa,
      type: r.type,
      catalog: r.catalog,
      genre: r.genre,
      items: toItems(r.metas, 24),
      hasMore: true,
    }))

  if (rails.length === 0) {
    return ok({ error: 'UPSTREAM_ERROR', message: 'خطا در دریافت اطلاعات از دیتابیس فیلم و سریال. چند لحظه بعد تلاش کنید.' }, 502)
  }
  return ok({ hero: heroCards, rails })
}
