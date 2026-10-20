'use client'

/**
 * Direct-download resolver (client-side).
 *
 * The sandbox server cannot reach archive.org, but the user's browser can.
 * We query the Internet Archive (CORS-enabled) for public-domain / freely
 * distributed copies of a title and return a real direct MP4 link when found.
 *
 * Honest contract:
 *  - resolveDirectDownload() returns a real downloadable file URL, or null.
 *  - 'network' error means the browser could not reach archive.org.
 */

export interface DirectDownload {
  identifier: string
  title: string
  year: string | null
  fileName: string
  url: string
  sizeMB: number | null
}

const SEARCH_TIMEOUT = 10_000
const META_TIMEOUT = 10_000

async function fetchJson<T>(url: string, timeout: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function yearDistance(a: string | null, b: string | undefined | null): number {
  const na = Number((a ?? '').slice(0, 4))
  const nb = Number((b ?? '').slice(0, 4))
  if (!na || !nb) return 99
  return Math.abs(na - nb)
}

export async function resolveDirectDownload(
  title: string,
  year: string | null,
): Promise<DirectDownload | null> {
  const q = `title:("${title.replace(/"/g, '')}") AND mediatype:(movies)`
  const searchUrl =
    'https://archive.org/advancedsearch.php?q=' +
    encodeURIComponent(q) +
    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=8&page=1&output=json'

  let docs: Array<{ identifier: string; title?: string; year?: string }>
  try {
    const data = await fetchJson<{ response?: { docs?: typeof docs } }>(searchUrl, SEARCH_TIMEOUT)
    docs = data.response?.docs ?? []
  } catch {
    throw new Error('network')
  }

  // prefer items matching the year closely
  docs.sort((a, b) => yearDistance(year, a.year) - yearDistance(year, b.year))

  for (const doc of docs.slice(0, 4)) {
    try {
      const meta = await fetchJson<{ files?: Array<{ name: string; format?: string; size?: string }> }>(
        `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`,
        META_TIMEOUT,
      )
      const files = meta.files ?? []
      const videos = files
        .filter((f) => {
          const fmt = (f.format ?? '').toLowerCase()
          const name = f.name.toLowerCase()
          return fmt.includes('h.264') || fmt.includes('mpeg4') || name.endsWith('.mp4') || name.endsWith('.mkv')
        })
        .map((f) => ({ ...f, bytes: Number(f.size ?? '0') || 0 }))
        .sort((a, b) => b.bytes - a.bytes)
      const best = videos[0]
      if (!best) continue
      return {
        identifier: doc.identifier,
        title: doc.title ?? title,
        year: doc.year ?? year,
        fileName: best.name,
        url: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(best.name)}`,
        sizeMB: best.bytes ? Math.round(best.bytes / (1024 * 1024)) : null,
      }
    } catch {
      continue
    }
  }
  return null
}
