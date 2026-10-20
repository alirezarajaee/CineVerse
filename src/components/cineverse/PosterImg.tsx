'use client'

import { useState } from 'react'
import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  src: string | null
  alt: string
  className?: string
  eager?: boolean
}

function Placeholder({ alt }: { alt: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-t from-[#101319] to-[#22252f]"
      role="img"
      aria-label={alt}
    >
      <Film className="h-6 w-6 text-muted-foreground/40" aria-hidden />
    </div>
  )
}

/** Keyed by src so failed/loaded state resets naturally when the source changes. */
function RemoteImg({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (failed) return <Placeholder alt={alt} />

  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-elevated" aria-hidden />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </>
  )
}

/**
 * Remote poster/backdrop image (metahub.space or similar CDNs).
 * Shows a pulse while loading and a cinematic gradient placeholder
 * with a Film icon when the URL is missing or fails to load.
 */
export function PosterImg({ src, alt, className, eager }: Props) {
  return (
    <div className={cn('relative overflow-hidden bg-elevated', className)}>
      {src ? <RemoteImg key={src} src={src} alt={alt} eager={eager} /> : <Placeholder alt={alt} />}
    </div>
  )
}
