import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { ok, AUTH_REQUIRED } from '@/lib/http'

export const dynamic = 'force-dynamic'

function shape(s: {
  uiLang: string
  subtitleLang: string
  audioLang: string
  defaultQuality: string
  defaultServer: string
  saveHistory: boolean
  dataSaver: boolean
  autoplayNext: boolean
}) {
  return {
    uiLang: s.uiLang,
    subtitleLang: s.subtitleLang,
    audioLang: s.audioLang,
    defaultQuality: s.defaultQuality,
    defaultServer: s.defaultServer,
    saveHistory: s.saveHistory,
    dataSaver: s.dataSaver,
    autoplayNext: s.autoplayNext,
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return AUTH_REQUIRED()
  let settings = await db.userSettings.findUnique({ where: { userId: user.id } })
  if (!settings) settings = await db.userSettings.create({ data: { userId: user.id } })
  return ok(shape(settings))
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return AUTH_REQUIRED()
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return ok({ error: 'BAD_BODY' }, 400)

  const data: Record<string, unknown> = {}
  if (typeof body.uiLang === 'string') data.uiLang = body.uiLang
  if (typeof body.subtitleLang === 'string') data.subtitleLang = body.subtitleLang
  if (typeof body.audioLang === 'string') data.audioLang = body.audioLang
  if (typeof body.defaultQuality === 'string') data.defaultQuality = body.defaultQuality
  if (typeof body.defaultServer === 'string') data.defaultServer = body.defaultServer
  if (typeof body.saveHistory === 'boolean') data.saveHistory = body.saveHistory
  if (typeof body.dataSaver === 'boolean') data.dataSaver = body.dataSaver
  if (typeof body.autoplayNext === 'boolean') data.autoplayNext = body.autoplayNext

  const settings = await db.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  })
  return ok(shape(settings))
}
