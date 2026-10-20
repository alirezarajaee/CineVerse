import { getCatalog, metaToCard, type MType, type CatalogId, CATALOG_IDS } from '@/lib/providers/metadata'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Paginated live catalog listing (top / year / imdbRating, optional genre). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? 'movie') as MType
  const catalog = (url.searchParams.get('catalog') ?? 'top') as CatalogId
  const genre = url.searchParams.get('genre') ?? undefined
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? '0') || 0)

  if (type !== 'movie' && type !== 'series') return ok({ error: 'BAD_TYPE' }, 400)
  if (!CATALOG_IDS.includes(catalog)) return ok({ error: 'BAD_CATALOG' }, 400)

  try {
    const metas = await getCatalog(type, catalog, { genre: genre || undefined, skip })
    return ok({ items: metas.map(metaToCard), page: Math.floor(skip / 100) + 1, hasMore: metas.length >= 100 })
  } catch (err) {
    console.error('[api/catalog]', err)
    return ok({ error: 'UPSTREAM_ERROR', message: 'خطا در دریافت فهرست. چند لحظه بعد تلاش کنید.' }, 502)
  }
}
