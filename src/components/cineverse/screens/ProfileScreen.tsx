'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bookmark, ChevronLeft, Download, Globe, Heart, History, Info, Loader2, LogOut, PlayCircle,
  Settings2, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useNav, useApp } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type NativeBridge = { getAppUrl?: () => string; openServerUrlDialog?: () => void; getAppVersion?: () => string }
function getNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { CineVerseNative?: NativeBridge }).CineVerseNative ?? null
}

export function ProfileScreen() {
  const { push, setTab, resetToTabs } = useNav()
  const sessionUser = useApp((s) => s.sessionUser)
  const qc = useQueryClient()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [nativeUrl, setNativeUrl] = useState<string | null>(null)
  const native = getNativeBridge()

  // «session» query refetch on mount (when stale) — App.tsx syncs the result into useApp
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: 30_000 })
  void session.isFetching // keep the refetch effect; no extra UI for it

  const favorites = useQuery({ queryKey: ['favorites'], queryFn: api.favorites })
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist })

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear()
      useApp.getState().setSession(null)
      useApp.getState().setSettings(null)
      resetToTabs('home')
      useApp.getState().setPhase('welcome')
      toast.success('از حساب خارج شدید')
    },
    onError: () => toast.error('خروج ناموفق بود؛ دوباره تلاش کنید.'),
  })

  const deleteAccount = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      qc.clear()
      useApp.getState().setSession(null)
      useApp.getState().setSettings(null)
      resetToTabs('home')
      useApp.getState().setPhase('welcome')
      toast.success('حساب و همه داده‌های شما حذف شد')
    },
    onError: () => toast.error('حذف حساب ناموفق بود؛ دوباره تلاش کنید.'),
  })

  if (!sessionUser) return <div className="h-full" />

  const user = sessionUser
  const isGuest = user.isGuest

  const displayName = isGuest ? 'مهمان' : (user.name ?? user.username ?? 'کاربر CineVerse')
  const initialSource = (user.name ?? user.username ?? user.email ?? '؟').trim()
  const initial = initialSource.charAt(0).toUpperCase()
  const subLine = isGuest ? 'حساب موقت روی همین دستگاه' : (user.email ?? user.username ?? '—')

  const menu = [
    { icon: <Settings2 className="h-5 w-5" aria-hidden />, label: 'تنظیمات', onClick: () => push({ name: 'settings' }) },
    { icon: <History className="h-5 w-5" aria-hidden />, label: 'تاریخچه تماشا', onClick: () => push({ name: 'history' }) },
    { icon: <PlayCircle className="h-5 w-5" aria-hidden />, label: 'ادامه تماشا', onClick: () => push({ name: 'continue' }) },
    { icon: <Info className="h-5 w-5" aria-hidden />, label: 'درباره CineVerse', onClick: () => push({ name: 'about' }) },
  ]

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-24">
      <motion.div
        className="flex flex-col items-center pt-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-elevated">
          {user.image ? (
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-black text-primary" aria-hidden>{initial}</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-[17px] font-black">{displayName}</h1>
          {isGuest && (
            <Badge className="border-0 bg-primary/15 text-[10px] font-bold text-primary hover:bg-primary/15">
              حساب مهمان
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground" dir="auto">{subLine}</p>
      </motion.div>

      {/* guest upgrade hint */}
      {isGuest && (
        <div className="mx-5 mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-4">
          <p className="text-[11.5px] leading-6 text-foreground/85">
            برای نگه‌داری دائمی کتابخانه، حساب بسازید. علاقه‌مندی‌ها، لیست تماشا و تاریخچه‌ی فعلی‌تان
            بدون تغییر به حساب منتقل می‌شود.
          </p>
          <Button
            onClick={() => {
              toast.info('حساب بسازید یا وارد شوید تا داده‌هایتان حفظ شود.')
              useApp.getState().setPhase('welcome')
            }}
            className="mt-3 h-10 w-full rounded-xl text-[13px] font-bold transition-transform active:scale-[0.99]"
          >
            ساخت حساب / ورود
          </Button>
        </div>
      )}

      {/* stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        <StatCard
          icon={<Heart className="h-4.5 w-4.5" aria-hidden />}
          label="علاقه‌مندی‌ها"
          count={favorites.isPending ? null : (favorites.data?.length ?? 0)}
          onClick={() => setTab('library')}
        />
        <StatCard
          icon={<Bookmark className="h-4.5 w-4.5" aria-hidden />}
          label="لیست تماشا"
          count={watchlist.isPending ? null : (watchlist.data?.length ?? 0)}
          onClick={() => setTab('library')}
        />
      </div>

      {/* downloads — APK + source */}
      <section className="mx-4 mt-5 rounded-2xl border border-primary/20 bg-card/60 p-4" aria-label="دریافت فایل‌ها">
        <div className="flex items-center gap-2">
          <Download className="h-4.5 w-4.5 text-primary" aria-hidden />
          <h2 className="text-[13.5px] font-black">دریافت فایل‌ها</h2>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
          فایل نصب اندروید (APK) و سورس کامل پروژه از همین نشانی قابل دانلود است.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <a
            href="/downloads/CineVerse.apk"
            download
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-bold text-white transition-transform active:scale-[0.99]"
          >
            <Download className="h-4 w-4" aria-hidden />
            دانلود APK اندروید
          </a>
          <a
            href="/downloads/cineverse-source.zip"
            download
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-elevated px-4 text-[13px] font-bold transition-transform active:scale-[0.99]"
          >
            <Download className="h-4 w-4" aria-hidden />
            دانلود سورس کامل پروژه (ZIP)
          </a>
        </div>
      </section>

      {/* native bridge — only inside the Android APK */}
      {native && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4.5 w-4.5 text-primary" aria-hidden />
            <h2 className="text-[13.5px] font-black">اتصال اپ اندروید</h2>
          </div>
          <p className="mt-1.5 break-all text-[11px] leading-5 text-muted-foreground" dir="ltr">
            {nativeUrl || '—'}
          </p>
          <button
            onClick={() => {
              native.openServerUrlDialog?.()
              setTimeout(() => setNativeUrl(native.getAppUrl?.() || '—'), 400)
            }}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-4 text-[13px] font-bold text-primary transition-transform active:scale-[0.99]"
          >
            تغییر آدرس سرور در اپ اندروید
          </button>
        </div>
      )}

      {/* menu */}
      <nav className="mt-5 space-y-1 px-4" aria-label="منوی پروفایل">
        {menu.map((m) => (
          <button
            key={m.label}
            onClick={m.onClick}
            className="flex min-h-[48px] w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-right transition-colors hover:bg-card"
          >
            <span className="text-foreground/80">{m.icon}</span>
            <span className="flex-1 text-[13.5px] font-semibold">{m.label}</span>
            <ChevronLeft className="h-4.5 w-4.5 text-muted-foreground/60" aria-hidden />
          </button>
        ))}
      </nav>

      {/* actions */}
      <div className="mt-4 space-y-1 px-4">
        {!isGuest && (
          <MenuAction
            icon={<LogOut className="h-5 w-5" aria-hidden />}
            label="خروج از حساب"
            onClick={() => setLogoutOpen(true)}
          />
        )}
        <MenuAction
          icon={<Trash2 className="h-5 w-5" aria-hidden />}
          label={isGuest ? 'حذف حساب مهمان و داده‌ها' : 'حذف حساب'}
          onClick={() => setDeleteOpen(true)}
        />
      </div>

      <p className="mt-8 text-center text-[10px] leading-5 text-muted-foreground/50">
        CineVerse — ساخته‌شده توسط علیرضا رجایی
      </p>

      {/* logout confirm */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">خروج از حساب؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-6">
              فقط نشست فعلی بسته می‌شود؛ داده‌های کتابخانه شما باقی می‌ماند و با ورود بعدی در دسترس است.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2">
            <AlertDialogAction
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {logout.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> در حال خروج…</>
              ) : (
                'خروج'
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={logout.isPending}>انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              {isGuest ? 'حذف حساب مهمان؟' : 'حذف کامل حساب؟'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-6">
              همه داده‌های شما شامل علاقه‌مندی‌ها، لیست تماشا و تاریخچه تماشا به‌صورت دائمی حذف می‌شود.
              این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2">
            <AlertDialogAction
              onClick={() => deleteAccount.mutate()}
              disabled={deleteAccount.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> در حال حذف…</>
              ) : (
                'حذف دائمی'
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={deleteAccount.isPending}>انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({ icon, label, count, onClick }: {
  icon: React.ReactNode
  label: string
  count: number | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-card/60 px-3 py-3 transition-colors hover:bg-card active:scale-[0.98]"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-[16px] font-black leading-none">
        {count === null ? <span className="inline-block h-4 w-6 animate-pulse rounded bg-elevated" aria-hidden /> : count}
      </span>
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      <span className="sr-only">{label}: {count === null ? 'در حال بارگذاری' : `${count} مورد`}</span>
    </button>
  )
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-right transition-colors hover:bg-card"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-[13.5px] font-semibold text-primary">{label}</span>
    </button>
  )
}
