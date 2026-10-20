import { getSessionUser, googleOAuthConfigured } from '@/lib/session'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  return ok({
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          image: user.image,
          isGuest: user.isGuest,
          hasPassword: Boolean(user.passwordHash),
        }
      : null,
    googleConfigured: googleOAuthConfigured(),
  })
}
