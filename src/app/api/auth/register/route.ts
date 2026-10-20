import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getSessionUser, setSessionCookie, transferGuestData } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,24}$/

function shapeUser(u: { id: string; name: string | null; email: string | null; username: string | null; image: string | null; isGuest: boolean; passwordHash: string | null }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    image: u.image,
    isGuest: u.isGuest,
    hasPassword: Boolean(u.passwordHash),
  }
}

/**
 * Zero-config registration: email OR username + password — no external service.
 * If the current session is a guest, the guest account is upgraded in place
 * (all its library data stays).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { identifier?: string; password?: string; name?: string }
    | null
  const identifier = body?.identifier?.trim() ?? ''
  const password = body?.password ?? ''
  const name = body?.name?.trim() || null

  if (!identifier || !password) return ok({ error: 'BAD_BODY', message: 'ایمیل/نام کاربری و رمز عبور الزامی است.' }, 400)

  const isEmail = identifier.includes('@')
  if (isEmail && !EMAIL_RE.test(identifier))
    return ok({ error: 'BAD_EMAIL', message: 'ایمیل واردشده معتبر نیست.' }, 400)
  if (!isEmail && !USERNAME_RE.test(identifier))
    return ok({ error: 'BAD_USERNAME', message: 'نام کاربری باید ۳ تا ۲۴ کاراکتر (حروف، عدد، ـ) باشد.' }, 400)
  if (password.length < 6)
    return ok({ error: 'WEAK_PASSWORD', message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' }, 400)

  const email = isEmail ? identifier.toLowerCase() : null
  const username = isEmail ? null : identifier.toLowerCase()

  // uniqueness checks
  const conflict = email
    ? await db.user.findFirst({ where: { email } })
    : await db.user.findFirst({ where: { username } })
  if (conflict && !conflict.isGuest)
    return ok(
      { error: 'CONFLICT', message: 'این ایمیل/نام کاربری قبلاً ثبت شده است. وارد شوید.' },
      409,
    )

  const passwordHash = await bcrypt.hash(password, 10)
  const current = await getSessionUser()

  if (current?.isGuest) {
    // upgrade guest in place — keeps favorites/watchlist/history
    const updated = await db.user
      .update({
        where: { id: current.id },
        data: { email, username, passwordHash, name, isGuest: false },
      })
      .catch(async () => {
        // race on unique constraint
        return null
      })
    if (!updated)
      return ok({ error: 'CONFLICT', message: 'این ایمیل/نام کاربری قبلاً ثبت شده است. وارد شوید.' }, 409)
    await db.userSettings.upsert({
      where: { userId: updated.id },
      create: { userId: updated.id },
      update: {},
    })
    await setSessionCookie(updated.id)
    return ok({ user: shapeUser(updated), upgradedFromGuest: true })
  }

  const created = await db.user.create({
    data: { email, username, passwordHash, name, isGuest: false },
  })
  await db.userSettings.create({ data: { userId: created.id } })
  if (current && !current.isGuest && current.id !== created.id) {
    // logged-in user creating a separate account: nothing to transfer
  }
  await setSessionCookie(created.id)
  return ok({ user: shapeUser(created), upgradedFromGuest: false })
}

// keep transferGuestData referenced for future flows (import side-effect free)
void transferGuestData
