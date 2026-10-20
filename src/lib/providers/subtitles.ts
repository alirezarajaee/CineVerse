/**
 * Subtitle provider — OpenSubtitles v3 Stremio addon (public, keyless).
 * Returns real subtitle files (SRT) including Persian (per/fas/fa) tracks.
 * Files are proxied through /api/subtitles/file to avoid CORS issues.
 */

export interface RawSubtitle {
  id: string
  url: string
  lang: string
}

export interface SubtitleTrackDTO {
  id: string
  lang: string // normalized: fa | en | ar | ...
  label: string // Persian display label
  url: string // proxied URL (same-origin)
  format: 'srt' | 'vtt'
}

const ADDON = 'https://opensubtitles-v3.strem.io'

// Normalize Stremio lang codes to ISO 639-1 for the UI
const LANG_MAP: Record<string, { code: string; label: string }> = {
  fa: { code: 'fa', label: 'فارسی' },
  per: { code: 'fa', label: 'فارسی' },
  fas: { code: 'fa', label: 'فارسی' },
  pes: { code: 'fa', label: 'فارسی' },
  en: { code: 'en', label: 'انگلیسی' },
  eng: { code: 'en', label: 'انگلیسی' },
  ar: { code: 'ar', label: 'عربی' },
  ara: { code: 'ar', label: 'عربی' },
  tr: { code: 'tr', label: 'ترکی' },
  tur: { code: 'tr', label: 'ترکی' },
  es: { code: 'es', label: 'اسپانیایی' },
  spa: { code: 'es', label: 'اسپانیایی' },
  fr: { code: 'fr', label: 'فرانسوی' },
  fre: { code: 'fr', label: 'فرانسوی' },
  fra: { code: 'fr', label: 'فرانسوی' },
  de: { code: 'de', label: 'آلمانی' },
  ger: { code: 'de', label: 'آلمانی' },
  it: { code: 'it', label: 'ایتالیایی' },
  ita: { code: 'it', label: 'ایتالیایی' },
  pt: { code: 'pt', label: 'پرتغالی' },
  pob: { code: 'pt', label: 'پرتغالی (برزیل)' },
  ru: { code: 'ru', label: 'روسی' },
  rus: { code: 'ru', label: 'روسی' },
}

export function proxiedSubtitleUrl(rawUrl: string): string {
  return `/api/subtitles/file?u=${encodeURIComponent(rawUrl)}`
}

/** Fetch subtitle tracks for a movie or a series episode. */
export async function getSubtitleTracks(args: {
  type: 'movie' | 'series'
  imdbId: string
  season?: number | null
  episode?: number | null
}): Promise<SubtitleTrackDTO[]> {
  const { type, imdbId, season, episode } = args
  const path =
    type === 'series' && season && episode
      ? `series/${encodeURIComponent(`${imdbId}:${season}:${episode}`)}`
      : `movie/${encodeURIComponent(imdbId)}`

  const url = `${ADDON}/subtitles/${path}.json`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(9000),
  })
  if (!res.ok) throw new Error(`subtitle upstream ${res.status}`)
  const data = (await res.json()) as { subtitles?: RawSubtitle[] }
  const raw = data.subtitles ?? []

  // Build tracks: prioritize Persian, then English, then others (deduped per language, max 3 each)
  const perLangCount = new Map<string, number>()
  const tracks: SubtitleTrackDTO[] = []
  const seenIds = new Set<string>()

  const sorted = [...raw].sort((a, b) => {
    const rank = (l: string) => (l === 'fa' ? 0 : l === 'en' ? 1 : 2)
    const la = LANG_MAP[a.lang]?.code ?? a.lang
    const lb = LANG_MAP[b.lang]?.code ?? b.lang
    return rank(la) - rank(lb)
  })

  for (const s of sorted) {
    const mapped = LANG_MAP[s.lang] ?? { code: s.lang, label: s.lang.toUpperCase() }
    const count = perLangCount.get(mapped.code) ?? 0
    if (count >= 3) continue
    if (seenIds.has(s.id)) continue
    seenIds.add(s.id)
    perLangCount.set(mapped.code, count + 1)
    const idx = count + 1
    tracks.push({
      id: s.id,
      lang: mapped.code,
      label: idx > 1 ? `${mapped.label} (${idx})` : mapped.label,
      url: proxiedSubtitleUrl(s.url),
      format: 'srt',
    })
  }
  return tracks
}

const ALLOWED_SUB_HOSTS = /^https?:\/\/([a-z0-9-]+\.)*(strem\.io|opensubtitles\.org|opensubtitles\.com|opensubtitles\.net)(\/|$)/i

/** Validate a proxied subtitle URL against an allow-list (anti-SSRF). */
export function isAllowedSubtitleUrl(u: string): boolean {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? ALLOWED_SUB_HOSTS.test(u)
      : false
  } catch {
    return false
  }
}
