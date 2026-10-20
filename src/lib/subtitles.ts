// Subtitle engine: fetch + parse WebVTT / SRT cues for the custom RTL renderer

export interface SubCue {
  start: number
  end: number
  text: string
}

function tsToSec(ts: string): number {
  const m = ts.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/)
  if (!m) return NaN
  const h = Number(m[1] ?? 0)
  const min = Number(m[2])
  const s = Number(m[3])
  const ms = Number(m[4])
  return h * 3600 + min * 60 + s + ms / 1000
}

/** Parses WebVTT and SRT (converted) content into cues. */
export function parseSubtitles(raw: string): SubCue[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const cues: SubCue[] = []
  const blocks = text.split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '' && !/^WEBVTT/i.test(l.trim()) && !/^NOTE\b/i.test(l.trim()) && !/^\d+$/.test(l.trim()))
    if (lines.length === 0) continue
    const timingIdx = lines.findIndex((l) => l.includes('-->'))
    if (timingIdx === -1) continue
    const [startRaw, endRawPart] = lines[timingIdx].split('-->')
    const endRaw = (endRawPart ?? '').split(/\s+/)[0]
    const start = tsToSec(startRaw)
    const end = tsToSec(endRaw)
    if (Number.isNaN(start) || Number.isNaN(end)) continue
    const content = lines
      .slice(timingIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // strip inline tags
      .trim()
    if (content) cues.push({ start, end, text: content })
  }
  return cues.sort((a, b) => a.start - b.start)
}

export async function loadSubtitleTrack(url: string, format: 'vtt' | 'srt'): Promise<SubCue[]> {
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`subtitle fetch failed: ${res.status}`)
  const raw = await res.text()
  return parseSubtitles(raw)
}

export function activeCue(cues: SubCue[], t: number): SubCue | null {
  // Binary search for the active cue
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const c = cues[mid]
    if (t < c.start) hi = mid - 1
    else if (t > c.end) lo = mid + 1
    else return c
  }
  return null
}
