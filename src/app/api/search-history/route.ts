import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { ok, AUTH_REQUIRED } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return ok([])
  const rows = await db.searchQuery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  // Deduplicate by query, keep most recent first.
  const seen = new Set<string>()
  const unique: Array<{ id: string; query: string }> = []
  for (const r of rows) {
    const key = r.query.trim().toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      unique.push({ id: r.id, query: r.query })
    }
  }
  return ok(unique.slice(0, 12))
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ok({ saved: false })
  const body = (await request.json().catch(() => null)) as { query?: string } | null
  const q = body?.query?.trim()
  if (!q || q.length < 2) return ok({ saved: false })
  // Keep one row per query, most recent first
  await db.searchQuery.deleteMany({
    where: { userId: user.id, query: { equals: q } },
  })
  await db.searchQuery.create({ data: { userId: user.id, query: q } })
  // Cap history size
  const all = await db.searchQuery.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  if (all.length > 40) {
    await db.searchQuery.deleteMany({
      where: { id: { in: all.slice(30).map((r) => r.id) } },
    })
  }
  return ok({ saved: true })
}

export async function DELETE() {
  const user = await getSessionUser()
  if (!user) return AUTH_REQUIRED()
  await db.searchQuery.deleteMany({ where: { userId: user.id } })
  return ok({ success: true })
}
