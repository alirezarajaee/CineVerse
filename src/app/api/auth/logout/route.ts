import { clearSessionCookie } from '@/lib/session'
import { ok } from '@/lib/http'

export async function POST() {
  await clearSessionCookie()
  return ok({ success: true })
}
