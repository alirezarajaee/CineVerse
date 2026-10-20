import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getSessionUser, setSessionCookie, transferGuestData } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Zero-config login with email OR username + password.
 * A guest session's library data is transferred into the target account.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { identifier?: string; password?: string }
    | null
  const identifier = body?.identifier?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  if (!identifier || !password)
    return ok({ error: 'BAD_BODY', message: 'ایمیل/نام کاربری و رمز عبور الزامی است.' }, 400)

  const target = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  })
  if (!target || target.isGuest || !target.passwordHash)
    return ok({ error: 'INVALID_CREDENTIALS', message: 'ایمیل/نام کاربری یا رمز عبور اشتباه است.' }, 401)

  const valid = await bcrypt.compare(password, target.passwordHash)
  if (!valid)
    return ok({ error: 'INVALID_CREDENTIALS', message: 'ایمیل/نام کاربری یا رمز عبور اشتباه است.' }, 401)

  const guest = await getSessionUser()
  if (guest?.isGuest && guest.id !== target.id) {
    await transferGuestData(guest.id, target.id).catch(() => undefined)
  }
  await setSessionCookie(target.id)
  return ok({
    user: {
      id: target.id,
      name: target.name,
      email: target.email,
      username: target.username,
      image: target.image,
      isGuest: target.isGuest,
      hasPassword: Boolean(target.passwordHash),
    },
  })
}
