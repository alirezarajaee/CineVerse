import { db } from '@/lib/db'
import { requireUserAutoGuest } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

type SaveBody = {
  imdbId?: string
  type?: string
  title?: string
  poster?: string | null
  year?: string | null
  season?: number | null
  episode?: number | null
  episodeTitle?: string | null
  positionSec?: number
  durationSec?: number
  completed?: boolean
}

function shape(row: {
  id: string
  imdbId: string
  type: string
  title: string
  poster: string | null
  year: string | null
  season: number | null
  episode: number | null
  episodeTitle: string | null
  positionSec: number
  durationSec: number
  completed: boolean
  updatedAt: Date
}) {
  const percent = row.durationSec > 0 ? Math.min(100, (row.positionSec / row.durationSec) * 100) : 0
  return {
    id: row.id,
    imdbId: row.imdbId,
    type: row.type === 'series' ? 'series' : 'movie',
    title: row.title,
    poster: row.poster,
    year: row.year,
    season: row.season,
    episode: row.episode,
    episodeTitle: row.episodeTitle,
    positionSec: row.positionSec,
    durationSec: row.durationSec,
    percent,
    completed: row.completed,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const user = await requireUserAutoGuest()
  const mode = new URL(request.url).searchParams.get('mode') ?? 'history'
  const rows = await db.watchHistoryEntry.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 120,
  })
  let list = rows.map(shape)
  if (mode === 'continue') {
    list = list.filter(
      (h) => !h.completed && h.positionSec > 15 && h.durationSec > 0 && h.percent < 95,
    )
    list = list.slice(0, 20)
  }
  return ok(list)
}

/** Upsert playback progress for any title/episode from the live database. */
export async function POST(request: Request) {
  const user = await requireUserAutoGuest()
  const body = (await request.json().catch(() => null)) as SaveBody | null
  const imdbId = body?.imdbId
  if (!imdbId || !/^tt\d+$/.test(imdbId) || !body?.type || !body?.title)
    return ok({ error: 'BAD_BODY', message: 'داده پخش نامعتبر است.' }, 400)

  const season = body.season ?? null
  const episode = body.episode ?? null
  const existing = await db.watchHistoryEntry.findFirst({
    where: { userId: user.id, imdbId, season, episode },
  })

  const data = {
    type: body.type === 'series' ? 'series' : 'movie',
    title: body.title,
    poster: body.poster ?? null,
    year: body.year ?? null,
    season,
    episode,
    episodeTitle: body.episodeTitle ?? null,
    positionSec: Math.max(0, Number(body.positionSec ?? 0)),
    durationSec: Math.max(0, Number(body.durationSec ?? 0)),
    completed: Boolean(body.completed),
  }

  if (existing) {
    const updated = await db.watchHistoryEntry.update({ where: { id: existing.id }, data })
    return ok({ saved: true, item: shape(updated) })
  }
  const created = await db.watchHistoryEntry.create({ data: { ...data, userId: user.id, imdbId } })
  return ok({ saved: true, item: shape(created) })
}

export async function DELETE() {
  const user = await requireUserAutoGuest()
  await db.watchHistoryEntry.deleteMany({ where: { userId: user.id } })
  return ok({ success: true })
}
