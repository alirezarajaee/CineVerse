'use client'

import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useNav, usePlayer, useApp } from '@/lib/store'
import { PhoneShell } from './PhoneShell'
import { BottomNav } from './BottomNav'
import { SplashScreen } from './screens/SplashScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { HomeScreen } from './screens/HomeScreen'
import { SearchScreen } from './screens/SearchScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { DetailScreen } from './screens/DetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { AboutScreen } from './screens/AboutScreen'
import { CatalogScreen } from './screens/CatalogScreen'
import { HistoryScreen, ContinueScreen } from './screens/HistoryScreen'
import { WatchScreen } from './player/WatchScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export function CineVerseApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <PhoneShell>
        <Root />
      </PhoneShell>
    </QueryClientProvider>
  )
}

type Phase = 'splash' | 'welcome' | 'app'

function Root() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: 30_000 })
  const { stack, tab } = useNav()
  const phase = useApp((s) => s.phase)
  const player = usePlayer()

  // Bootstrap: session check + OAuth redirect handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      toast.success('با موفقیت وارد شدید')
      window.history.replaceState({}, '', '/')
    }
    const authError = params.get('authError')
    if (authError) {
      toast.error('ورود با Google ناموفق بود: ' + decodeAuthError(authError))
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Sync session into the external store (not React state)
  useEffect(() => {
    if (!session.isSuccess) return
    const data = session.data
    useApp.getState().setSession(data.user, data.googleConfigured)
    if (useApp.getState().phase === 'splash' && data.user) {
      useApp.getState().setPhase('app')
    }
  }, [session.isSuccess, session.data])

  // Settings bootstrap for the player defaults
  useEffect(() => {
    if (session.data?.user) {
      api.settings().then((s) => useApp.getState().setSettings(s)).catch(() => undefined)
    }
  }, [session.data?.user])

  const status: 'checking' | 'ready' = session.isPending ? 'checking' : 'ready'

  if (phase === 'splash') {
    return (
      <SplashScreen
        status={status}
        onEnter={() => {
          if (session.data?.user) useApp.getState().setPhase('app')
          else useApp.getState().setPhase('welcome')
        }}
      />
    )
  }

  if (phase === 'welcome') {
    return (
      <WelcomeScreen
        onGuest={() => undefined}
        onDone={async () => {
          await session.refetch()
          useApp.getState().setSession(session.data?.user ?? null)
          useApp.getState().setPhase('app')
          useNav.getState().resetToTabs('home')
        }}
      />
    )
  }

  const top = stack[stack.length - 1]

  return (
    <div className="relative h-full w-full bg-background">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={top ? `s:${top.name}:${'imdbId' in top ? top.imdbId : 'label' in top ? top.label : ''}` : `tabs:${tab}`}
          className="absolute inset-0 flex flex-col"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {top ? <StackScreen top={top} /> : <TabScreen tab={tab} />}
        </motion.div>
      </AnimatePresence>

      {!top && <BottomNav />}

      {player.open && player.payload && <WatchScreen payload={player.payload} />}
    </div>
  )
}

function TabScreen({ tab }: { tab: string }) {
  if (tab === 'search') return <SearchScreen />
  if (tab === 'library') return <LibraryScreen />
  if (tab === 'profile') return <ProfileScreen />
  return <HomeScreen />
}

function StackScreen({ top }: { top: ReturnType<typeof useNav.getState>['stack'][number] }) {
  switch (top.name) {
    case 'detail':
      return <DetailScreen imdbId={top.imdbId} type={top.type} />
    case 'catalog':
      return <CatalogScreen type={top.type} catalog={top.catalog} genre={top.genre} label={top.label} />
    case 'settings':
      return <SettingsScreen />
    case 'about':
      return <AboutScreen />
    case 'history':
      return <HistoryScreen />
    case 'continue':
      return <ContinueScreen />
    default:
      return <HomeScreen />
  }
}

function decodeAuthError(code: string): string {
  const map: Record<string, string> = {
    state_mismatch: 'خطای امنیتی نشست ورود',
    missing_code: 'پاسخ نامعتبر از Google',
    token_exchange_failed: 'تبدیل کد ورود ناموفق بود',
    userinfo_failed: 'دریافت اطلاعات حساب ناموفق بود',
    not_configured: 'کلیدهای OAuth تنظیم نشده‌اند',
    email_conflict: 'این ایمیل با حساب دیگری مرتبط است',
  }
  return map[code] ?? code
}
