'use client'

import { motion } from 'framer-motion'
import { Film } from 'lucide-react'

export function CineVerseLogo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative flex items-center justify-center rounded-full bg-primary shadow-[0_0_60px_rgba(229,9,20,0.45)] ${size === 'lg' ? 'h-20 w-20' : 'h-9 w-9'}`}>
        <Film className={size === 'lg' ? 'h-10 w-10 text-primary-foreground' : 'h-5 w-5 text-primary-foreground'} aria-hidden />
        <span aria-hidden className="absolute inset-0 rounded-full pulse-ring" />
      </div>
      <div className="flex items-baseline" dir="ltr">
        <span className={`${size === 'lg' ? 'text-4xl' : 'text-xl'} font-black tracking-tight text-foreground`}>Cine</span>
        <span className={`${size === 'lg' ? 'text-4xl' : 'text-xl'} font-black tracking-tight text-primary`}>Verse</span>
      </div>
    </div>
  )
}

export function SplashScreen({ onEnter, status }: { onEnter: () => void; status: 'checking' | 'ready' }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-background">
      {/* Cinematic red beam backdrop */}
      <div aria-hidden className="absolute inset-0">
        <img src="/art/splash-hero.png" alt="" className="h-full w-full object-cover opacity-75 brightness-[0.42] saturate-[1.15] contrast-[1.05]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/35 to-background" />
        <motion.div
          className="absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[80px]"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <CineVerseLogo />
        <motion.p
          className="mt-4 text-[13px] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          دنیای فیلم و سریال در دستان شما
        </motion.p>
      </motion.div>

      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-10 pb-14"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ paddingBottom: 'max(3.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onEnter}
          disabled={status === 'checking'}
          className="w-full max-w-[300px] rounded-full bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground shadow-[0_8px_30px_rgba(229,9,20,0.4)] transition-all active:scale-95 disabled:opacity-60"
        >
          {status === 'checking' ? 'در حال آماده‌سازی…' : 'شروع'}
        </button>
        <button onClick={onEnter} className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground">
          ورود به حساب کاربری
        </button>
      </motion.div>
    </div>
  )
}
