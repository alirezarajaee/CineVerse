'use client'

import { Home, Search, Library, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNav, type Tab } from '@/lib/store'

const tabs: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'خانه', icon: Home },
  { id: 'search', label: 'جست‌وجو', icon: Search },
  { id: 'library', label: 'کتابخانه', icon: Library },
  { id: 'profile', label: 'پروفایل', icon: UserRound },
]

export function BottomNav() {
  const { tab, setTab } = useNav()
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-[#0B0D12]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      aria-label="ناوبری اصلی"
    >
      <div className="grid grid-cols-4">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 pt-1.5 focus:outline-none"
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-[21px] w-[21px] transition-all', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              <span className={cn('text-[10.5px] leading-none transition-colors', active ? 'font-bold text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
              <span className={cn('h-0.5 w-6 rounded-full transition-all', active ? 'bg-primary' : 'bg-transparent')} aria-hidden />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
