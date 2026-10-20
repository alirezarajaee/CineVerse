import { getSubtitleTracks, type SubtitleTrackDTO } from '@/lib/providers/subtitles'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Real subtitle tracks (incl. Persian) from the OpenSubtitles Stremio addon.
 * Files are proxied via /api/subtitles/file so the client can parse them.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? 'movie') as 'movie' | 'series'
  const imdb = url.searchParams.get('imdb') ?? ''
  const season = Number(url.searchParams.get('season') ?? '') || null
  const episode = Number(url.searchParams.get('episode') ?? '') || null

  if ((type !== 'movie' && type !== 'series') || !/^tt\d+$/.test(imdb))
    return ok({ error: 'BAD_PARAMS' }, 400)

  try {
    const tracks: SubtitleTrackDTO[] = await getSubtitleTracks({ type, imdbId: imdb, season, episode })
    return ok(tracks)
  } catch (err) {
    console.error('[api/subtitles]', err)
    return ok([], 200) // graceful: no subtitles available right now
  }
}
