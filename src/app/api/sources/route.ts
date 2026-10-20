import { getEmbedSources, type MType } from '@/lib/providers/sources'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Playable servers for a title (embeds keyed by IMDb/TMDb — covers the full database). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? 'movie') as MType
  const imdb = url.searchParams.get('imdb') ?? ''
  const season = Number(url.searchParams.get('season') ?? '') || null
  const episode = Number(url.searchParams.get('episode') ?? '') || null
  const tmdb = Number(url.searchParams.get('tmdb') ?? '') || null

  if ((type !== 'movie' && type !== 'series') || !/^tt\d+$/.test(imdb))
    return ok({ error: 'BAD_PARAMS' }, 400)

  const sources = getEmbedSources({ type, imdbId: imdb, tmdbId: tmdb, season, episode })
  return ok({ sources })
}
