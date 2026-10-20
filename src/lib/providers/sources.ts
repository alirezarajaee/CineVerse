/**
 * Playback source registry.
 *
 * Every searched title becomes playable through a set of public streaming
 * embeds (IMDb/TMDb keyed). The player UI offers server switching if one
 * provider is unavailable. Direct-file sources (when resolvable) enable the
 * native HTML5 player with real Persian subtitle tracks and real downloads.
 */

export type MType = 'movie' | 'series'

export interface SourceDTO {
  id: string
  name: string
  note: string
  kind: 'embed' | 'file'
  url: string
}

interface EmbedServer {
  id: string
  name: string
  note: string
  build: (args: { type: MType; imdbId: string; tmdbId?: number | null; season?: number | null; episode?: number | null }) => string
}

const SERVERS: EmbedServer[] = [
  {
    id: 'vidlink',
    name: 'ویدلینک',
    note: 'پخش‌کننده پیشنهادی — کیفیت بالا و زیرنویس فارسی در تنظیمات خود پلیر',
    build: ({ type, imdbId, season, episode }) =>
      type === 'series'
        ? `https://vidlink.pro/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`
        : `https://vidlink.pro/movie/${imdbId}`,
  },
  {
    id: 'vidsrc-su',
    name: 'ویدسورس SU',
    note: 'سرور جایگزین با پشتیبانی چندکیفیتی',
    build: ({ type, imdbId, season, episode }) =>
      type === 'series'
        ? `https://vidsrc.su/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.su/embed/movie/${imdbId}`,
  },
  {
    id: 'vidsrc-xyz',
    name: 'ویدسورس XYZ',
    note: 'سرور سریع؛ در صورت قطعی سرور دیگری را امتحان کنید',
    build: ({ type, imdbId, tmdbId, season, episode }) =>
      type === 'series'
        ? `https://vidsrc.xyz/embed/tv/${tmdbId ? `tmdb-${tmdbId}` : imdbId}?season=${season ?? 1}&episode=${episode ?? 1}`
        : `https://vidsrc.xyz/embed/movie?${tmdbId ? `tmdb=${tmdbId}` : `imdb=${imdbId}`}`,
  },
  {
    id: 'two-embed',
    name: 'توامبد',
    note: 'سرور سبک برای اینترنت ضعیف‌تر',
    build: ({ type, imdbId, season, episode }) =>
      type === 'series'
        ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season ?? 1}&e=${episode ?? 1}`
        : `https://www.2embed.cc/embed/${imdbId}`,
  },
  {
    id: 'multiembed',
    name: 'مولتی‌امبد',
    note: 'سرور پشتیبان نهایی',
    build: ({ type, imdbId, season, episode }) =>
      type === 'series'
        ? `https://multiembed.mov/?video_id=${imdbId}&s=${season ?? 1}&e=${episode ?? 1}`
        : `https://multiembed.mov/?video_id=${imdbId}`,
  },
  {
    id: 'vidsrc-to',
    name: 'ویدسورس TO',
    note: 'سرور جایگزین',
    build: ({ type, imdbId, season, episode }) =>
      type === 'series'
        ? `https://vidsrc.to/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.to/embed/movie/${imdbId}`,
  },
]

export function getEmbedSources(args: {
  type: MType
  imdbId: string
  tmdbId?: number | null
  season?: number | null
  episode?: number | null
}): SourceDTO[] {
  return SERVERS.map((s) => ({
    id: s.id,
    name: s.name,
    note: s.note,
    kind: 'embed' as const,
    url: s.build(args),
  }))
}
