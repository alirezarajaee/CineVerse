import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  getSessionUser,
  transferGuestData,
  verifyOAuthState,
} from '@/lib/session'

/**
 * Google OAuth callback — exchanges the authorization code for tokens via the official
 * token endpoint, fetches verified userinfo, upserts the account (auto-registration on
 * first login) and transfers any previous guest library into it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const origin = process.env.APP_ORIGIN ?? url.origin

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(reason)}`, 302)

  const store = await cookies()
  const cookieState = store.get(OAUTH_STATE_COOKIE)?.value
  store.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
  if (!verifyOAuthState(state) || !cookieState || cookieState !== state) return fail('state_mismatch')
  if (!code) return fail('missing_code')
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return fail('not_configured')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) return fail('token_exchange_failed')
  const tokens = (await tokenRes.json()) as { access_token?: string }
  if (!tokens.access_token) return fail('no_access_token')

  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) return fail('userinfo_failed')
  const info = (await infoRes.json()) as { sub: string; email?: string; name?: string; picture?: string; email_verified?: boolean }
  if (!info.sub) return fail('invalid_userinfo')

  // Upsert by stable Google subject id — repeat logins never create duplicate profiles.
  let user = await db.user.findUnique({ where: { googleSub: info.sub } })
  if (!user) {
    const byEmail = info.email ? await db.user.findUnique({ where: { email: info.email } }) : null
    if (byEmail && byEmail.googleSub && byEmail.googleSub !== info.sub) return fail('email_conflict')
    user = await db.user.create({
      data: { googleSub: info.sub, email: info.email ?? null, name: info.name ?? null, image: info.picture ?? null, isGuest: false },
    })
    await db.userSettings.create({ data: { userId: user.id } })
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: { email: info.email ?? user.email, name: info.name ?? user.name, image: info.picture ?? user.image },
    })
  }

  // Transfer the previous guest library (if any) into this account.
  const previous = await getSessionUser()
  if (previous && previous.isGuest && previous.id !== user.id) {
    await transferGuestData(previous.id, user.id)
  }

  const secureCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  }
  store.set(SESSION_COOKIE, createSessionToken(user.id), secureCookie)
  return NextResponse.redirect(`${origin}/?auth=success`, 302)
}
