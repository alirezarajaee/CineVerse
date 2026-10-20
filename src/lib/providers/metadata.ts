/**
 * Live metadata provider — Cinemeta (Stremio's official IMDb-backed catalog).
 *
 * Keyless public API covering the full movie & series database:
 *   - Catalogs : /catalog/{type}/{catalog}/{extras}.json
 *   - Search   : /catalog/{type}/top/search={query}.json
 *   - Detail   : /meta/{type}/{imdbId}.json
 * Images are served from images.metahub.space (poster/background/logo).
 *
 * All responses are normalized and cached in-memory to respect upstream limits.
 */

const BASE = 'https://v3-cinemeta.strem.io'
const UA = 'CineVerse/1.0 (+https://cineverse.app)'

export type MType = 'movie' | 'series'

export interface RawMeta {
  id: string
  type: string
  name: string
  releaseInfo?: string
  year?: string
  imdbRating?: string
  popularity?: number
  popularities?: Record<string, number>
  poster?: string
  background?: string
  logo?: string
  description?: string
  genre?: string[]
  genres?: string[]
  runtime?: string
  cast?: string[]
  director?: string[]
  writer?: string[]
  country?: string
  awards?: string
  status?: string
  trailers?: Array<{ source: string; type: string }>
  moviedb_id?: number
  videos?: Array<{
    id: string
    season: number
    episode: number
    name?: string
    title?: string
    overview?: string
    description?: string
    thumb?: string
    released?: string
    firstAired?: string
  }>
}

interface CacheEntry {
  expires: number
  data: unknown
}

const cache = new Map<string, CacheEntry>()

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.data as T
  if (hit) cache.delete(key)
  return null
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  // simple size guard
  if (cache.size > 600) {
    const now = Date.now()
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k)
    if (cache.size > 600) cache.clear()
  }
  cache.set(key, { expires: Date.now() + ttlMs, data })
}

async function fetchJson<T>(url: string, timeoutMs = 9000, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': UA },
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`upstream ${res.status} @ ${url}`)
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('upstream failed')
}

// ——————————————————————————————— Catalogs ———————————————————————————————

export const CATALOG_IDS = ['top', 'year', 'imdbRating'] as const
export type CatalogId = (typeof CATALOG_IDS)[number]

/** Fetch a catalog (up to 100 metas) with optional genre/search/skip extras. */
export async function getCatalog(
  type: MType,
  catalog: CatalogId = 'top',
  opts: { genre?: string; search?: string; skip?: number } = {},
): Promise<RawMeta[]> {
  const extras: string[] = []
  if (opts.genre) extras.push(`genre=${encodeURIComponent(opts.genre)}`)
  if (opts.search) extras.push(`search=${encodeURIComponent(opts.search)}`)
  const qs = opts.skip ? `&skip=${opts.skip}` : ''
  const key = `cat:${type}:${catalog}:${extras.join('&')}:${qs}`
  const cached = cacheGet<{ metas: RawMeta[] }>(key)
  if (cached) return cached.metas ?? []

  // Primary host 307-redirects to cinemeta-catalogs.strem.io; some server-side
  // fetch implementations mishandle that hop, and the CDN occasionally answers
  // 404 intermittently — so we alternate both hosts across several attempts.
  const extrasPart = extras.length > 0 ? `/${extras.join('&')}` : ''
  const path = `catalog/${type}/${catalog}${extrasPart}.json${qs}`
  const candidates = [
    `${BASE}/${path}`,
    `https://cinemeta-catalogs.strem.io/${catalog}/${path}`,
  ]

  let metas: RawMeta[] | null = null
  let lastErr: unknown = null
  outer: for (let round = 0; round < 3; round++) {
    for (const url of candidates) {
      try {
        const data = await fetchJson<{ metas?: RawMeta[] }>(url, 9000, 1)
        const m = data.metas ?? []
        if (m.length > 0) {
          metas = m
          break outer
        }
        // 200 with empty list = upstream hiccup, keep trying
        lastErr = new Error('empty metas')
      } catch (err) {
        lastErr = err
      }
    }
    await new Promise((r) => setTimeout(r, 600 * (round + 1)))
  }

  if (metas && metas.length > 0) {
    cacheSet(key, { metas }, 10 * 60_000)
    cacheSet(`stale:${key}`, { metas }, 24 * 60 * 60_000)
    return metas
  }
  // serve stale data rather than failing the page (upstream hiccups are transient)
  const stale = cacheGet<{ metas: RawMeta[] }>(`stale:${key}`)
  if (stale) return stale.metas ?? []
  if (lastErr) throw lastErr
  return []
}

export async function searchMetas(type: MType, query: string, skip = 0): Promise<RawMeta[]> {
  const q = query.trim()
  if (!q) return []
  return getCatalog(type, 'top', { search: q, skip })
}

export async function getMeta(type: MType, imdbId: string): Promise<RawMeta> {
  const url = `${BASE}/meta/${type}/${encodeURIComponent(imdbId)}.json`
  const cached = cacheGet<{ meta: RawMeta }>(url)
  if (cached) return cached.meta
  const data = await fetchJson<{ meta: RawMeta }>(url, 12_000, 2)
  if (!data?.meta?.id) throw new Error('meta_not_found')
  cacheSet(url, data, 30 * 60_000)
  return data.meta
}

// ——————————————————————————————— Normalization ———————————————————————————————

export function normalizePoster(p?: string): string | null {
  if (!p) return null
  // upgrade metahub small posters to medium for crispness
  return p.replace('/poster/small/', '/poster/medium/')
}

export function metaToCard(m: RawMeta): {
  imdbId: string
  type: MType
  title: string
  year: string | null
  rating: number | null
  poster: string | null
  background: string | null
  logo: string | null
  genres: string[]
  runtime: string | null
  description: string | null
} {
  const genres = (m.genres ?? m.genre ?? []).slice(0, 4)
  return {
    imdbId: m.id,
    type: (m.type === 'series' ? 'series' : 'movie') as MType,
    title: m.name,
    year: m.releaseInfo ?? m.year ?? null,
    rating: m.imdbRating ? Number(m.imdbRating) : null,
    poster: normalizePoster(m.poster),
    background: m.background ?? null,
    logo: m.logo ?? null,
    genres,
    runtime: m.runtime ?? null,
    description: m.description ?? null,
  }
}

// ——————————————————————————————— Persian labels ———————————————————————————————

const GENRE_FA: Record<string, string> = {
  Action: 'اکشن',
  Adventure: 'ماجراجویی',
  Animation: 'انیمیشن',
  Biography: 'زندگی‌نامه',
  Comedy: 'کمدی',
  Crime: 'جنایی',
  Documentary: 'مستند',
  Drama: 'درام',
  Family: 'خانوادگی',
  Fantasy: 'فانتزی',
  History: 'تاریخی',
  Horror: 'ترسناک',
  Music: 'موسیقی',
  Musical: 'موسیقایی',
  Mystery: 'معمایی',
  Romance: 'عاشقانه',
  'Sci-Fi': 'علمی‌تخیلی',
  'Science Fiction': 'علمی‌تخیلی',
  Short: 'کوتاه',
  Sport: 'ورزشی',
  Thriller: 'هیجانی',
  War: 'جنگی',
  Western: 'وسترن',
  Reality: 'واقعی',
  'Talk-Show': 'تاک‌شو',
  News: 'خبری',
  'Game-Show': 'مسابقه‌ای',
  'Film-Noir': 'نوآر',
  Supernatural: 'فراطبیعی',
  Suspense: 'تعلیق',
}

export function genreFa(en: string): string {
  return GENRE_FA[en.trim()] ?? en
}

export const BROWSE_GENRES: Array<{ en: string; fa: string }> = [
  { en: 'Action', fa: 'اکشن' },
  { en: 'Comedy', fa: 'کمدی' },
  { en: 'Drama', fa: 'درام' },
  { en: 'Romance', fa: 'عاشقانه' },
  { en: 'Thriller', fa: 'هیجانی' },
  { en: 'Horror', fa: 'ترسناک' },
  { en: 'Sci-Fi', fa: 'علمی‌تخیلی' },
  { en: 'Animation', fa: 'انیمیشن' },
  { en: 'Crime', fa: 'جنایی' },
  { en: 'Mystery', fa: 'معمایی' },
  { en: 'Fantasy', fa: 'فانتزی' },
  { en: 'Adventure', fa: 'ماجراجویی' },
  { en: 'Documentary', fa: 'مستند' },
  { en: 'Family', fa: 'خانوادگی' },
  { en: 'History', fa: 'تاریخی' },
  { en: 'War', fa: 'جنگی' },
]
