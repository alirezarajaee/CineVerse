import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

/**
 * CineVerse session layer.
 * - Stateless signed cookie (HMAC-SHA256) holding only the user id.
 * - Guest sessions are real User rows (isGuest = true) so library data is server-persisted.
 * - Zero-config accounts: email/username + bcrypt password — no external service needed.
 * - Register/login upgrades a guest session and transfers its data.
 */

export const SESSION_COOKIE = 'cv_session'
export const OAUTH_STATE_COOKIE = 'cv_oauth_state'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) {
    // Dev fallback only; .env ships with a generated 64-char hex secret.
    return 'cineverse-dev-secret-do-not-use-in-production'
  }
  return s
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function createSessionToken(userId: string): string {
  const payload = b64url(JSON.stringify({ uid: userId, iat: Date.now(), exp: Date.now() + MAX_AGE * 1000 }))
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: string; exp?: number }
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return data.uid
  } catch {
    return null
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false, // sandbox preview runs over http; set true behind https proxy in production
  path: '/',
  maxAge: MAX_AGE,
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(userId), cookieOptions)
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 })
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies()
  const uid = verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid } })
}

/** Create a real guest account with default settings and open a session for it. */
export async function createGuestSession(): Promise<User> {
  const user = await db.user.create({ data: { isGuest: true } })
  await db.userSettings.create({ data: { userId: user.id } })
  await setSessionCookie(user.id)
  return user
}

/** Ensure the caller has a session user; create a guest automatically when missing. */
export async function requireUser(): Promise<User | null> {
  return getSessionUser()
}

/** Make sure a session exists (auto-guest) and return it — used by library APIs. */
export async function requireUserAutoGuest(): Promise<User> {
  const existing = await getSessionUser()
  if (existing) return existing
  return createGuestSession()
}

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function makeOAuthState(): string {
  const nonce = randomBytes(16).toString('base64url')
  return `${nonce}.${sign(nonce)}`
}

export function verifyOAuthState(state: string | undefined | null): boolean {
  if (!state) return false
  const dot = state.lastIndexOf('.')
  if (dot <= 0) return false
  const nonce = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(sign(nonce))
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Merge a guest account's library into a real account (idempotent), then delete the guest. */
export async function transferGuestData(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) return
  const [guestFavs, guestList, guestHist, guestQueries] = await Promise.all([
    db.favorite.findMany({ where: { userId: fromUserId } }),
    db.watchlistItem.findMany({ where: { userId: fromUserId } }),
    db.watchHistoryEntry.findMany({ where: { userId: fromUserId }, orderBy: { updatedAt: 'desc' } }),
    db.searchQuery.findMany({ where: { userId: fromUserId }, orderBy: { createdAt: 'desc' } }),
  ])
  for (const f of guestFavs) {
    await db.favorite.upsert({
      where: { userId_imdbId: { userId: toUserId, imdbId: f.imdbId } },
      create: {
        userId: toUserId, imdbId: f.imdbId, type: f.type, title: f.title,
        poster: f.poster, year: f.year, rating: f.rating,
      },
      update: {},
    })
  }
  for (const w of guestList) {
    await db.watchlistItem.upsert({
      where: { userId_imdbId: { userId: toUserId, imdbId: w.imdbId } },
      create: {
        userId: toUserId, imdbId: w.imdbId, type: w.type, title: w.title,
        poster: w.poster, year: w.year, rating: w.rating,
      },
      update: {},
    })
  }
  for (const h of guestHist) {
    const existing = await db.watchHistoryEntry.findFirst({
      where: { userId: toUserId, imdbId: h.imdbId, season: h.season, episode: h.episode },
    })
    if (!existing) {
      await db.watchHistoryEntry.create({
        data: {
          userId: toUserId, imdbId: h.imdbId, type: h.type, title: h.title,
          poster: h.poster, year: h.year, season: h.season, episode: h.episode,
          episodeTitle: h.episodeTitle,
          positionSec: h.positionSec, durationSec: h.durationSec, completed: h.completed,
        },
      })
    } else if (existing.updatedAt < h.updatedAt) {
      await db.watchHistoryEntry.update({
        where: { id: existing.id },
        data: { positionSec: h.positionSec, durationSec: h.durationSec, completed: h.completed },
      })
    }
  }
  const existingQueries = new Set(
    (await db.searchQuery.findMany({ where: { userId: toUserId } })).map((q) => q.query.trim().toLowerCase())
  )
  for (const q of guestQueries) {
    const key = q.query.trim().toLowerCase()
    if (key && !existingQueries.has(key)) {
      await db.searchQuery.create({ data: { userId: toUserId, query: q.query } })
      existingQueries.add(key)
    }
  }
  // Guest account is fully absorbed — remove it.
  await db.user.delete({ where: { id: fromUserId } }).catch(() => undefined)
}
