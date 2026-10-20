import { db } from '@/lib/db'
import { requireUserAutoGuest } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

type Snapshot = {
  imdbId?: string
  type?: string
  title?: string
  poster?: string | null
  year?: string | null
  rating?: number | null
}

function shape(row: {
  imdbId: string
  type: string
  title: string
  poster: string | null
  year: string | null
  rating: number | null
  createdAt: Date
}) {
  return {
    addedAt: row.createdAt.toISOString(),
    item: {
      imdbId: row.imdbId,
      type: row.type === 'series' ? 'series' : 'movie',
      title: row.title,
      poster: row.poster,
      year: row.year,
      rating: row.rating,
    },
  }
}

export async function GET() {
  const user = await requireUserAutoGuest()
  const rows = await db.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return ok(rows.map(shape))
}

/** Toggle favorite for ANY title from the live database (snapshot stored). */
export async function POST(request: Request) {
  const user = await requireUserAutoGuest()
  const body = (await request.json().catch(() => null)) as Snapshot | null
  const imdbId = body?.imdbId
  if (!imdbId || !/^tt\d+$/.test(imdbId) || !body?.type || !body?.title)
    return ok({ error: 'BAD_BODY', message: 'داده عنوان نامعتبر است.' }, 400)

  const existing = await db.favorite.findUnique({
    where: { userId_imdbId: { userId: user.id, imdbId } },
  })
  if (existing) {
    await db.favorite.delete({ where: { userId_imdbId: { userId: user.id, imdbId } } })
    return ok({ favorite: false })
  }
  await db.favorite.create({
    data: {
      userId: user.id,
      imdbId,
      type: body.type === 'series' ? 'series' : 'movie',
      title: body.title,
      poster: body.poster ?? null,
      year: body.year ?? null,
      rating: body.rating ?? null,
    },
  })
  return ok({ favorite: true })
}
