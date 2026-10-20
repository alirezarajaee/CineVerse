import { clearSessionCookie, getSessionUser } from '@/lib/session'
import { db } from '@/lib/db'
import { ok } from '@/lib/http'

/** Permanently deletes the current account and every related row (cascade). */
export async function POST() {
  const user = await getSessionUser()
  if (!user) return ok({ success: true })
  await db.user.delete({ where: { id: user.id } })
  await clearSessionCookie()
  return ok({ success: true })
}
