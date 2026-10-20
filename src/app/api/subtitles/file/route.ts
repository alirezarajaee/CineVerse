import { isAllowedSubtitleUrl } from '@/lib/providers/subtitles'

export const dynamic = 'force-dynamic'

/**
 * Same-origin proxy for subtitle files (SRT/VTT) — avoids CORS issues and
 * keeps the client-side RTL subtitle engine working. Allow-listed hosts only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = url.searchParams.get('u')
  if (!target || !isAllowedSubtitleUrl(target)) {
    return new Response(JSON.stringify({ error: 'BAD_URL' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const res = await fetch(target, {
      headers: { 'user-agent': 'CineVerse/1.0', accept: '*/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return new Response(JSON.stringify({ error: 'UPSTREAM_ERROR' }), { status: 502, headers: { 'content-type': 'application/json' } })

    const buf = await res.arrayBuffer()
    const head = new Uint8Array(buf.slice(0, 4))
    // ZIP magic → subtitle packed as archive; we cannot use it directly
    if (head[0] === 0x50 && head[1] === 0x4b) {
      return new Response(JSON.stringify({ error: 'ARCHIVE_SUB' }), { status: 415, headers: { 'content-type': 'application/json' } })
    }

    return new Response(buf, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=86400',
        'access-control-allow-origin': '*',
      },
    })
  } catch (err) {
    console.error('[api/subtitles/file]', err)
    return new Response(JSON.stringify({ error: 'FETCH_FAILED' }), { status: 504, headers: { 'content-type': 'application/json' } })
  }
}
