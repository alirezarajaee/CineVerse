'use client'

import { useEffect } from 'react'

/**
 * Desktop wrapper: renders the app inside a phone-like shell with ambient glow.
 * On mobile (<sm) the app goes full-bleed like a native app.
 */
export function PhoneShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Prevent browser scroll bounce behind the shell on desktop
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#05060899] sm:bg-[radial-gradient(120%_100%_at_50%_0%,#14161f_0%,#050608_60%)]">
      {/* Ambient background for desktop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 hidden sm:block">
        <div className="absolute left-1/2 top-1/3 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.05] blur-[120px]" />
        <div className="absolute bottom-10 right-1/4 h-64 w-64 rounded-full bg-[#46d369]/[0.03] blur-[90px]" />
      </div>

      <div
        className="relative z-10 h-screen w-full overflow-hidden bg-background sm:h-[min(880px,94vh)] sm:w-[414px] sm:rounded-[2.4rem] sm:border sm:border-white/10 sm:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),0_0_0_10px_#0b0d12,0_0_0_11px_rgba(255,255,255,0.06)]"
        role="application"
        aria-label="CineVerse"
      >
        {children}
      </div>
    </div>
  )
}
