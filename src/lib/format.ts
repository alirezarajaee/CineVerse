export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function fmtRuntime(min: number | null | undefined): string {
  if (!min) return '—'
  if (min < 60) return `${min} دقیقه`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} ساعت و ${m} دقیقه` : `${h} ساعت`
}

export function fmtVotes(votes: number | null | undefined): string {
  if (!votes) return ''
  if (votes >= 1000) return `${(votes / 1000).toFixed(1)}K`
  return String(votes)
}

export function kindLabel(kind: string, isAnimation: boolean): string {
  if (isAnimation) return 'انیمیشن'
  return kind === 'SERIES' ? 'سریال' : 'فیلم'
}

/** Choose a local fallback poster based on the title's genre mood. */
export function fallbackPoster(genres: Array<{ slug: string }>): string {
  if (genres.some((g) => ['action', 'adventure', 'crime'].includes(g.slug))) return '/art/fallback-action.png'
  if (genres.some((g) => ['sci-fi', 'fantasy', 'animation'].includes(g.slug))) return '/art/fallback-scifi.png'
  return '/art/fallback-drama.png'
}
