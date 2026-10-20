import { createGuestSession } from '@/lib/session'
import { ok } from '@/lib/http'

export async function POST() {
  const user = await createGuestSession()
  return ok({
    user: { id: user.id, name: user.name, email: user.email, image: user.image, isGuest: user.isGuest },
  })
}
