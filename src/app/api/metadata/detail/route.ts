import { db } from '@/lib/db'
import { getMeta, getCatalog, metaToCard, type MType } from '@/lib/providers/metadata'
import { getEmbedSources } from '@/lib/providers/sources'
import { getSessionUser } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Full detail for any title in the live database:
 * meta, cast, seasons/episodes, playable sources, similar titles,
 * and the user's favorite/watchlist/progress state.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? 'movie') as MType
  const imdb = url.searchParams.get('imdb') ?? ''
  if ((type !== 'movie' && type !== 'series') || !/^tt\d+$/.test(imdb))
    return ok({ error: 'BAD_PARAMS' }, 400)

  try {
    const meta = await getMeta(type, imdb)
    const card = metaToCard(meta)

    const seasons = new Map<number, { number: number; episodes: Array<{ key: string; season: number; number: number; name: string; overview: string | null; thumb: string | null; released: string | null }> }>()
    for (const v of meta.videos ?? []) {
      if (typeof v.season !== 'number' || typeof v.episode !== 'number') continue
      const s = seasons.get(v.season) ?? { number: v.season, episodes: [] }
      s.episodes.push({
        key: v.id ?? `${imdb}:${v.season}:${v.episode}`,
        season: v.season,
        number: v.episode,
        name: v.name ?? v.title ?? `قسمت ${v.episode}`,
        overview: v.overview ?? v.description ?? null,
        thumb: v.thumb ?? null,
        released: v.released ?? v.firstAired ?? null,
      })
      seasons.set(v.season, s)
    }
    const seasonList = [...seasons.values()]
      .sort((a, b) => a.number - b.number)
      .map((s) => ({ ...s, episodes: s.episodes.sort((a, b) => a.number - b.number) }))

    // similar from the first genre (cached upstream)
    const firstGenre = card.genres[0]
    let similar: ReturnType<typeof metaToCard>[] = []
    if (firstGenre) {
      try {
        const cat = await getCatalog(type, 'top', { genre: firstGenre })
        similar = cat.filter((m) => m.id !== imdb).slice(0, 12).map(metaToCard)
      } catch { /* non-fatal */ }
    }

    // user state (guest or account)
    const user = await getSessionUser()
    let favorite = false
    let watchlist = false
    let progress: { positionSec: number; durationSec: number; completed: boolean } | null = null
    if (user) {
      const [fav, wl] = await Promise.all([
        db.favorite.findUnique({ where: { userId_imdbId: { userId: user.id, imdbId: imdb } } }),
        db.watchlistItem.findUnique({ where: { userId_imdbId: { userId: user.id, imdbId: imdb } } }),
      ])
      favorite = Boolean(fav)
      watchlist = Boolean(wl)
      const h = await db.watchHistoryEntry.findFirst({
        where: { userId: user.id, imdbId: imdb },
        orderBy: { updatedAt: 'desc' },
      })
      if (h) progress = { positionSec: h.positionSec, durationSec: h.durationSec, completed: h.completed }
    }

    const sources = getEmbedSources({
      type,
      imdbId: imdb,
      tmdbId: meta.moviedb_id ?? null,
      season: (seasonList.find((s) => s.number >= 1) ?? seasonList[0])?.number ?? 1,
      episode: (seasonList.find((s) => s.number >= 1) ?? seasonList[0])?.episodes[0]?.number ?? 1,
    })

    return ok({
      title: {
        ...card,
        awards: meta.awards ?? null,
        country: meta.country ?? null,
        status: meta.status ?? null,
        trailer: meta.trailers?.[0]?.source ?? null,
        moviedbId: meta.moviedb_id ?? null,
        released: (meta as { released?: string }).released ?? null,
      },
      cast: (meta.cast ?? []).slice(0, 14).map((n) => ({ name: n, character: null })),
      director: meta.director ?? [],
      writer: meta.writer ?? [],
      seasons: seasonList,
      sources,
      similar,
      user: { favorite, watchlist, progress },
    })
  } catch (err) {
    console.error('[api/metadata/detail]', err)
    return ok({ error: 'DETAIL_ERROR', message: 'خطا در دریافت جزئیات این عنوان. چند لحظه بعد تلاش کنید.' }, 502)
  }
}
