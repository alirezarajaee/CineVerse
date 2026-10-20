import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { googleOAuthConfigured, makeOAuthState, OAUTH_STATE_COOKIE } from '@/lib/session'
import { err } from '@/lib/http'

/**
 * Starts the real Google OAuth 2.0 Authorization Code flow.
 * Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env — otherwise returns 503
 * so the UI can show an honest "not configured" state instead of a fake login.
 */
export async function GET(request: Request) {
  if (!googleOAuthConfigured()) {
    return err('OAUTH_NOT_CONFIGURED',
      'ورود با Google نیازمند تنظیم GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET در فایل .env است.',
      503)
  }
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/google/callback`
  const state = makeOAuthState()
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 600,
  })
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')
  return NextResponse.redirect(authUrl.toString(), 302)
}
