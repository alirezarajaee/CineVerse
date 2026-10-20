'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Info, Loader2 } from 'lucide-react'
import { CineVerseLogo } from './SplashScreen'
import { api, ApiError } from '@/lib/api'
import { useApp } from '@/lib/store'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,24}$/

type Busy = null | 'login' | 'register' | 'guest'

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.8 3C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.1 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.2 6.6l3.9 3c1-2.9 3.7-4.9 6.9-4.9z" />
    </svg>
  )
}

function validateIdentifier(raw: string): string | null {
  const v = raw.trim()
  if (!v) return 'ایمیل یا نام کاربری را وارد کنید.'
  if (v.includes('@')) {
    if (!EMAIL_RE.test(v)) return 'ایمیل واردشده معتبر نیست.'
  } else if (!USERNAME_RE.test(v)) {
    return 'نام کاربری باید ۳ تا ۲۴ کاراکتر (حروف، عدد یا ـ) باشد.'
  }
  return null
}

function validatePassword(v: string): string | null {
  if (v.length < 6) return 'رمز عبور باید حداقل ۶ کاراکتر باشد.'
  return null
}

export function WelcomeScreen({ onGuest, onDone }: { onGuest: () => void; onDone: () => void }) {
  const googleConfigured = useApp((s) => s.googleConfigured)
  const qc = useQueryClient()

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState<Busy>(null)
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [showRegPw, setShowRegPw] = useState(false)

  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [regId, setRegId] = useState('')
  const [regPw, setRegPw] = useState('')
  const [regName, setRegName] = useState('')
  const [loginErr, setLoginErr] = useState<string | null>(null)
  const [regErr, setRegErr] = useState<string | null>(null)

  /** data of the guest (if any) belongs to the target account after login/register — drop stale cache */
  function invalidateStaleCache() {
    qc.invalidateQueries()
  }

  async function handleLogin() {
    const idErr = validateIdentifier(loginId)
    const pwErr = validatePassword(loginPw)
    setLoginErr(idErr ?? pwErr)
    if (idErr || pwErr) return
    setBusy('login')
    try {
      const res = await api.login({ identifier: loginId.trim(), password: loginPw })
      if (res.user) useApp.getState().setSession(res.user)
      invalidateStaleCache()
      toast.success('خوش آمدید! با موفقیت وارد شدید.')
      onGuest()
      onDone()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'ورود ناموفق بود؛ اتصال را بررسی کنید.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRegister() {
    const idErr = validateIdentifier(regId)
    const pwErr = validatePassword(regPw)
    setRegErr(idErr ?? pwErr)
    if (idErr || pwErr) return
    setBusy('register')
    try {
      const name = regName.trim()
      const res = await api.register({
        identifier: regId.trim(),
        password: regPw,
        ...(name ? { name } : {}),
      })
      if (res.user) useApp.getState().setSession(res.user)
      invalidateStaleCache()
      toast.success('حساب شما ساخته شد؛ خوش آمدید!')
      onGuest()
      onDone()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'ساخت حساب ناموفق بود؛ اتصال را بررسی کنید.')
    } finally {
      setBusy(null)
    }
  }

  async function handleGuest() {
    // an existing guest session must not be orphaned by creating another one
    if (useApp.getState().sessionUser?.isGuest) {
      onGuest()
      onDone()
      return
    }
    setBusy('guest')
    try {
      const res = await api.createGuest()
      if (res.user) useApp.getState().setSession(res.user)
      invalidateStaleCache()
      toast.success('به‌عنوان مهمان وارد شدید؛ هر وقت خواستید حساب بسازید.')
      onGuest()
      onDone()
    } catch {
      toast.error('ایجاد حساب مهمان ناموفق بود. اتصال را بررسی کنید.')
    } finally {
      setBusy(null)
    }
  }

  function switchTab(v: string) {
    setTab(v === 'register' ? 'register' : 'login')
    setLoginErr(null)
    setRegErr(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div aria-hidden className="absolute inset-0">
        <img src="/art/welcome-bg.png" alt="" className="h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/40 to-background" />
      </div>

      <div className="relative z-10 flex h-full flex-col overflow-y-auto no-scrollbar">
        <motion.div
          className="flex flex-col items-center px-8 pt-12"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <CineVerseLogo />
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            دنیای فیلم و سریال در دستان شما
          </p>
        </motion.div>

        <motion.div
          className="mt-auto w-full px-5 pb-7 pt-6"
          style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="rounded-3xl border border-white/10 bg-card/90 p-4 shadow-2xl backdrop-blur-xl">
            <Tabs value={tab} onValueChange={switchTab}>
              <TabsList className="mb-3 h-10 w-full rounded-xl bg-elevated/80 p-1">
                <TabsTrigger value="login" className="rounded-lg text-[13px] font-bold">
                  ورود
                </TabsTrigger>
                <TabsTrigger value="register" className="rounded-lg text-[13px] font-bold">
                  ثبت‌نام
                </TabsTrigger>
              </TabsList>

              {/* ————— ورود ————— */}
              <TabsContent value="login" className="space-y-2.5">
                <label htmlFor="login-identifier" className="sr-only">ایمیل یا نام کاربری</label>
                <Input
                  id="login-identifier"
                  dir="auto"
                  autoComplete="username"
                  placeholder="ایمیل یا نام کاربری"
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); if (loginErr) setLoginErr(null) }}
                  aria-invalid={!!loginErr && !loginErr.startsWith('رمز')}
                  className="h-11 rounded-xl border-white/10 bg-elevated/50 text-[13.5px]"
                />
                <div className="relative">
                  <label htmlFor="login-password" className="sr-only">رمز عبور</label>
                  <Input
                    id="login-password"
                    type={showLoginPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="رمز عبور"
                    value={loginPw}
                    onChange={(e) => { setLoginPw(e.target.value); if (loginErr) setLoginErr(null) }}
                    aria-invalid={!!loginErr && loginErr.startsWith('رمز')}
                    className="h-11 rounded-xl border-white/10 bg-elevated/50 pl-11 text-[13.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw((v) => !v)}
                    aria-label={showLoginPw ? 'پنهان‌کردن رمز' : 'نمایش رمز'}
                    className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                  >
                    {showLoginPw ? <EyeOff className="h-4.5 w-4.5" aria-hidden /> : <Eye className="h-4.5 w-4.5" aria-hidden />}
                  </button>
                </div>
                {loginErr && (
                  <p className="px-1 text-[11px] leading-5 text-destructive" role="alert">{loginErr}</p>
                )}
                <Button
                  onClick={handleLogin}
                  disabled={busy !== null}
                  className="mt-1 h-11 w-full rounded-xl text-[14px] font-bold shadow-[0_8px_24px_rgba(229,9,20,0.35)] transition-transform active:scale-[0.99]"
                >
                  {busy === 'login' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> در حال ورود…</>
                  ) : (
                    'ورود'
                  )}
                </Button>
              </TabsContent>

              {/* ————— ثبت‌نام ————— */}
              <TabsContent value="register" className="space-y-2.5">
                <label htmlFor="reg-identifier" className="sr-only">ایمیل یا نام کاربری</label>
                <Input
                  id="reg-identifier"
                  dir="auto"
                  autoComplete="username"
                  placeholder="ایمیل یا نام کاربری"
                  value={regId}
                  onChange={(e) => { setRegId(e.target.value); if (regErr) setRegErr(null) }}
                  aria-invalid={!!regErr && !regErr.startsWith('رمز')}
                  className="h-11 rounded-xl border-white/10 bg-elevated/50 text-[13.5px]"
                />
                <div className="relative">
                  <label htmlFor="reg-password" className="sr-only">رمز عبور (حداقل ۶ کاراکتر)</label>
                  <Input
                    id="reg-password"
                    type={showRegPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                    value={regPw}
                    onChange={(e) => { setRegPw(e.target.value); if (regErr) setRegErr(null) }}
                    aria-invalid={!!regErr && regErr.startsWith('رمز')}
                    className="h-11 rounded-xl border-white/10 bg-elevated/50 pl-11 text-[13.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw((v) => !v)}
                    aria-label={showRegPw ? 'پنهان‌کردن رمز' : 'نمایش رمز'}
                    className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                  >
                    {showRegPw ? <EyeOff className="h-4.5 w-4.5" aria-hidden /> : <Eye className="h-4.5 w-4.5" aria-hidden />}
                  </button>
                </div>
                <label htmlFor="reg-name" className="sr-only">نام نمایشی (اختیاری)</label>
                <Input
                  id="reg-name"
                  dir="auto"
                  autoComplete="name"
                  placeholder="نام نمایشی (اختیاری)"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="h-11 rounded-xl border-white/10 bg-elevated/50 text-[13.5px]"
                />
                {regErr && (
                  <p className="px-1 text-[11px] leading-5 text-destructive" role="alert">{regErr}</p>
                )}
                <Button
                  onClick={handleRegister}
                  disabled={busy !== null}
                  className="mt-1 h-11 w-full rounded-xl text-[14px] font-bold shadow-[0_8px_24px_rgba(229,9,20,0.35)] transition-transform active:scale-[0.99]"
                >
                  {busy === 'register' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> در حال ساخت حساب…</>
                  ) : (
                    'ساخت حساب'
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            <Separator className="my-3.5 bg-white/10" />

            {busy === 'guest' ? (
              <button
                disabled
                className="flex h-11 w-full items-center justify-center rounded-xl text-[13.5px] font-semibold text-muted-foreground"
              >
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> در حال آماده‌سازی…
              </button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleGuest}
                disabled={busy !== null}
                className="h-11 w-full rounded-xl text-[13.5px] font-semibold text-foreground/90 transition-colors hover:bg-elevated/60"
              >
                ورود به‌عنوان مهمان
              </Button>
            )}

            {googleConfigured ? (
              <button
                onClick={() => { window.location.href = '/api/auth/google' }}
                disabled={busy !== null}
                className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-white py-2.5 text-[14px] font-bold text-[#1f1f1f] transition-all hover:bg-white/95 active:scale-[0.99] disabled:opacity-60"
              >
                <GoogleG />
                ادامه با Google
              </button>
            ) : (
              <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-muted-foreground/75">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                ورود با Google به کلیدهای OAuth نیاز دارد؛ حساب CineVerse بدون هیچ تنظیماتی کار می‌کند.
              </p>
            )}

            <p className="mt-3.5 text-center text-[10px] leading-4 text-muted-foreground/60">
              با ورود، شرایط استفاده و سیاست حریم خصوصی CineVerse را می‌پذیرید.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
