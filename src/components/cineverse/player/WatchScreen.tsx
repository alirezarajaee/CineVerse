'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Check, Gauge, ListVideo, Loader2, Lock, Maximize, Minimize,
  Pause, PictureInPicture2, Play, RefreshCw, RotateCcw, RotateCw, Server, SkipForward,
  Subtitles, Type, Unlock, Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import Hls from 'hls.js'
import { api } from '@/lib/api'
import { usePlayer, useApp } from '@/lib/store'
import { fmtTime } from '@/lib/format'
import { loadSubtitleTrack, activeCue, type SubCue } from '@/lib/subtitles'
import { OptionSheet, type Option } from '../OptionSheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { HistoryItemDTO, PlayerPayload, SourceDTO, SubtitleTrackDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

type PlayState = 'loading' | 'ready' | 'buffering' | 'error'
type Sheet = null | 'server' | 'quality' | 'audio' | 'sub'

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]
const SUB_SIZES = { sm: 'text-[13px]', md: 'text-[16px]', lg: 'text-[20px]' } as const
const SUB_SIZE_FA: Record<keyof typeof SUB_SIZES, string> = { sm: 'کوچک', md: 'متوسط', lg: 'بزرگ' }
type SubSize = keyof typeof SUB_SIZES

interface Props {
  payload: PlayerPayload
}

/**
 * Full-screen watch overlay.
 *
 * - EMBED sources (all current servers): sandbox-free iframe + auto-hiding
 *   overlay chrome; watch-time is tracked honestly as wall-clock seconds.
 * - FILE sources (direct MP4/HLS): native <video> + hls.js with the full
 *   control set ported from the classic player (resume, 15s/pause/unload
 *   progress saves, quality/audio tracks, RTL subtitles, lock/PIP/speed).
 */
export function WatchScreen({ payload }: Props) {
  const closePlayer = usePlayer((s) => s.closePlayer)
  const settings = useApp((s) => s.settings)
  const qc = useQueryClient()

  const isSeries = payload.type === 'series'

  // ——— internal playback position (switchable inside the player) ———
  const [season, setSeason] = useState<number | null>(payload.season ?? null)
  const [episode, setEpisode] = useState<number | null>(payload.episode ?? null)
  const [episodeName, setEpisodeName] = useState<string | null>(payload.episodeName ?? null)
  const [serverId, setServerId] = useState<string | null>(payload.serverId ?? null)
  const [epoch, setEpoch] = useState(0) // manual retry trigger for source setup
  const [epSheetOpen, setEpSheetOpen] = useState(false)

  // ——— data (detail key is shared with DetailScreen) ———
  const detailQ = useQuery({
    queryKey: ['detail', payload.type, payload.imdbId],
    queryFn: () => api.detail(payload.type, payload.imdbId),
    staleTime: 60_000,
  })
  const tmdbId = detailQ.data?.title.moviedbId ?? null

  const sourcesQ = useQuery({
    queryKey: ['sources', payload.type, payload.imdbId, season, episode, tmdbId],
    queryFn: async () => {
      const sp = new URLSearchParams({ type: payload.type, imdb: payload.imdbId })
      if (season != null) sp.set('season', String(season))
      if (episode != null) sp.set('episode', String(episode))
      if (tmdbId != null) sp.set('tmdb', String(tmdbId))
      const res = await fetch(`/api/sources?${sp.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('sources_failed')
      return (await res.json()) as { sources: SourceDTO[] }
    },
    staleTime: 5 * 60_000,
  })

  // ——— selected source ———
  const sources = useMemo(() => sourcesQ.data?.sources ?? [], [sourcesQ.data])
  const preferredId = serverId ?? settings?.defaultServer ?? 'vidlink'
  const activeSource = useMemo<SourceDTO | null>(() => {
    if (sources.length === 0) return null
    const pref = sources.find((s) => s.id === preferredId)
    if (pref) return pref
    const file = sources.find((s) => s.kind === 'file')
    return file ?? sources[0]
  }, [sources, preferredId])
  const mode: 'embed' | 'file' | null = activeSource?.kind ?? null

  const subsQ = useQuery({
    queryKey: ['subs', payload.type, payload.imdbId, season, episode],
    queryFn: () => api.subtitles({ type: payload.type, imdbId: payload.imdbId, season, episode }),
    staleTime: 10 * 60_000,
    enabled: activeSource?.kind === 'file', // only the native player consumes tracks
  })
  const subTracks = useMemo<SubtitleTrackDTO[]>(() => subsQ.data ?? [], [subsQ.data])

  const histQ = useQuery({
    queryKey: ['history'],
    queryFn: api.history,
    enabled: isSeries && epSheetOpen,
    staleTime: 30_000,
  })

  // ——— file player state ———
  const videoRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const seekBarRef = useRef<HTMLDivElement>(null)
  const resumedRef = useRef(false)
  const flushedRef = useRef(false)

  const [playState, setPlayState] = useState<PlayState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [muted, setMuted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [fs, setFs] = useState(false)
  const [ended, setEnded] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // sheets
  const [sheet, setSheet] = useState<Sheet>(null)
  const [sheetSeason, setSheetSeason] = useState<number | null>(null)

  // hls technical state
  const [levels, setLevels] = useState<Array<{ index: number; height: number }>>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [audioTracks, setAudioTracks] = useState<Array<{ index: number; name: string }>>([])
  const [currentAudio, setCurrentAudio] = useState(-1)

  // subtitles
  const [activeSub, setActiveSub] = useState<string | 'off'>('off')
  const [cues, setCues] = useState<SubCue[]>([])
  const [cue, setCue] = useState<SubCue | null>(null)
  const [subSize, setSubSize] = useState<SubSize>('md')

  // ——— embed UI state ———
  const [embedControls, setEmbedControls] = useState(true)
  const hideTimerEmbed = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showIframeHint, setShowIframeHint] = useState(false)
  const iframeLoadedRef = useRef(false)

  // wall-clock watch seconds (embed mode) — embeds expose no timeline
  const watchedRef = useRef(0)

  // ——— latest-value refs (used by stable callbacks & cleanup) ———
  const settingsRef = useRef(settings)
  const modeRef = useRef<'embed' | 'file' | null>(mode)
  const metaRef = useRef({
    imdbId: payload.imdbId,
    type: payload.type,
    title: payload.title,
    poster: payload.poster,
    year: payload.year,
    season,
    episode,
    episodeName,
  })
  useEffect(() => {
    settingsRef.current = settings
    modeRef.current = mode
    metaRef.current = {
      imdbId: payload.imdbId,
      type: payload.type,
      title: payload.title,
      poster: payload.poster,
      year: payload.year,
      season,
      episode,
      episodeName,
    }
  })

  // ——— progress persistence (honest: only the native player knows its timeline) ———
  const persistFileProgress = useCallback((opts?: { completed?: boolean }) => {
    const v = videoRef.current
    if (!v || !v.duration || Number.isNaN(v.duration)) return
    if (!opts?.completed && v.currentTime < 5) return // noise guard
    if (settingsRef.current?.saveHistory === false) return
    const m = metaRef.current
    api
      .saveProgress({
        imdbId: m.imdbId,
        type: m.type,
        title: m.title,
        poster: m.poster,
        year: m.year,
        season: m.type === 'series' ? m.season : null,
        episode: m.type === 'series' ? m.episode : null,
        episodeTitle: m.type === 'series' ? m.episodeName : null,
        positionSec: v.currentTime,
        durationSec: v.duration,
        completed: opts?.completed ?? false,
      })
      .catch(() => undefined)
  }, [])

  const flushEmbedProgress = useCallback(() => {
    if (settingsRef.current?.saveHistory === false) return
    if (watchedRef.current < 5) return
    const m = metaRef.current
    api
      .saveProgress({
        imdbId: m.imdbId,
        type: m.type,
        title: m.title,
        poster: m.poster,
        year: m.year,
        season: m.type === 'series' ? m.season : null,
        episode: m.type === 'series' ? m.episode : null,
        episodeTitle: m.type === 'series' ? m.episodeName : null,
        positionSec: Math.round(watchedRef.current),
        durationSec: 0,
        completed: false,
      })
      .catch(() => undefined)
  }, [])

  const flushNow = useCallback(() => {
    if (flushedRef.current) return
    flushedRef.current = true
    if (modeRef.current === 'embed') flushEmbedProgress()
    else persistFileProgress()
    qc.invalidateQueries({ queryKey: ['history'] })
    qc.invalidateQueries({ queryKey: ['continue'] })
  }, [flushEmbedProgress, persistFileProgress, qc])
  const flushNowRef = useRef(flushNow)
  useEffect(() => {
    flushNowRef.current = flushNow
  })

  const handleClose = useCallback(() => {
    flushNowRef.current()
    closePlayer()
  }, [closePlayer])

  // unmount: final save + teardown (no concurrent players may survive)
  useEffect(() => {
    return () => {
      flushNowRef.current()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (hideTimerEmbed.current) clearTimeout(hideTimerEmbed.current)
    }
  }, [])

  // ——— embed: wall-clock counter + save on hide/unload ———
  useEffect(() => {
    if (mode !== 'embed') return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') watchedRef.current += 1
    }, 1000)
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushEmbedProgress()
    }
    const onHide = () => flushEmbedProgress()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [mode, flushEmbedProgress])

  // ——— file: periodic save + save on hide/unload ———
  useEffect(() => {
    if (mode !== 'file') return
    const t = setInterval(() => persistFileProgress(), 15000)
    const onVis = () => {
      if (document.visibilityState === 'hidden') persistFileProgress()
    }
    const onHide = () => persistFileProgress()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [mode, persistFileProgress])

  // ——— next episode lookup ———
  const seasons = detailQ.data?.seasons ?? []
  const nextEp = useMemo<{ season: number; episode: number; name: string | null } | null>(() => {
    if (!isSeries || season == null || episode == null) return null
    const si = seasons.findIndex((s) => s.number === season)
    if (si === -1) return null
    const s = seasons[si]
    const idx = s.episodes.findIndex((e) => e.number === episode)
    if (idx === -1) return null
    if (idx + 1 < s.episodes.length) {
      const n = s.episodes[idx + 1]
      return { season: s.number, episode: n.number, name: n.name }
    }
    const ns = seasons[si + 1]
    if (!ns || ns.episodes.length === 0) return null
    return { season: ns.number, episode: ns.episodes[0].number, name: ns.episodes[0].name }
  }, [seasons, isSeries, season, episode])
  const nextEpRef = useRef(nextEp)
  useEffect(() => {
    nextEpRef.current = nextEp
  }, [nextEp])

  // ——— player reset (episode/server switches, replay) ———
  const resetPlayerState = useCallback(() => {
    setPlayState('loading')
    setErrorMsg('')
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    setEnded(false)
    setCues([])
    setCue(null)
    setActiveSub('off')
    resumedRef.current = false
    flushedRef.current = false
    setIframeLoaded(false)
    iframeLoadedRef.current = false
    setShowIframeHint(false)
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    const v = videoRef.current
    if (v) {
      try {
        v.pause()
        v.removeAttribute('src')
        v.load()
      } catch {
        /* noop */
      }
    }
  }, [])

  const switchEpisode = useCallback(
    (s: number, e: number, name: string | null) => {
      flushNowRef.current() // record the outgoing episode first
      resetPlayerState()
      setSeason(s)
      setEpisode(e)
      setEpisodeName(name)
      setSheet(null)
      setEpSheetOpen(false)
      toast.info(name ? `قسمت ${e}: ${name}` : `فصل ${s} · قسمت ${e}`)
    },
    [resetPlayerState]
  )
  const switchEpisodeRef = useRef(switchEpisode)
  useEffect(() => {
    switchEpisodeRef.current = switchEpisode
  }, [switchEpisode])

  // ——— subtitle selection ———
  const selectSub = useCallback(async (track: SubtitleTrackDTO) => {
    setActiveSub(track.id)
    try {
      const parsed = await loadSubtitleTrack(track.url, track.format)
      setCues(parsed)
    } catch {
      toast.error('بارگذاری زیرنویس ناموفق بود')
      setActiveSub('off')
      setCues([])
    }
  }, [])

  // auto-select preferred language (default: Persian) once tracks arrive
  useEffect(() => {
    if (mode !== 'file') return
    if (activeSub !== 'off') return
    if (subTracks.length === 0) return
    const pref = settingsRef.current?.subtitleLang ?? 'fa'
    if (pref === 'off') return
    const def = subTracks.find((t) => (t.lang ?? '').toLowerCase().startsWith(pref))
    if (def) queueMicrotask(() => void selectSub(def))
  }, [mode, subTracks, activeSub, selectSub])

  // ——— file source setup (hls.js / progressive) ———
  useEffect(() => {
    const video = videoRef.current
    if (mode !== 'file' || !activeSource || !video) return
    resumedRef.current = false
    queueMicrotask(() => {
      setPlayState('loading')
      setErrorMsg('')
    })

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = activeSource.url
    if (url.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 30 })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, evtData) => {
        const lvls = evtData.levels
          .map((l, index) => ({ index, height: l.height ?? 0 }))
          .sort((a, b) => b.height - a.height)
        setLevels(lvls)
        const pref = settingsRef.current?.defaultQuality ?? 'auto'
        const saver = settingsRef.current?.dataSaver
        if (pref !== 'auto' || saver) {
          const target = saver ? Math.min(...lvls.map((l) => (l.height <= 480 ? l.height : 9999))) : Number(pref)
          const match = lvls.find((l) => l.height === target)
          if (match) hls.currentLevel = match.index
        }
        setCurrentLevel(hls.currentLevel)
        setPlayState('ready')
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, evtData) => setCurrentLevel(hls.autoLevelEnabled ? -1 : evtData.level))
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        const at = hls.audioTracks.map((t, index) => ({ index, name: t.name || t.lang || `ترک ${index + 1}` }))
        setAudioTracks(at)
        setCurrentAudio(hls.audioTrack)
      })
      hls.on(Hls.Events.ERROR, (_e, evtData) => {
        if (!evtData.fatal) return
        if (evtData.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setErrorMsg('خطای شبکه در دریافت جریان ویدئو')
        } else if (evtData.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError()
            return
          } catch {
            /* fallthrough */
          }
          setErrorMsg('خطای رمزگشایی ویدئو')
        } else {
          setErrorMsg('منبع پخش در دسترس نیست')
        }
        setPlayState('error')
      })
    } else {
      // plain progressive video (MP4) or native HLS (Safari)
      video.src = url
      queueMicrotask(() => setPlayState('ready'))
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [mode, activeSource?.id, activeSource?.url, epoch])

  // ——— media events (file mode) ———
  useEffect(() => {
    const v = videoRef.current
    if (mode !== 'file' || !v) return
    const onPlay = () => {
      setPlaying(true)
      setEnded(false)
    }
    const onPause = () => {
      setPlaying(false)
      persistFileProgress()
    }
    const onTime = () => {
      setCurrent(v.currentTime)
      if (cues.length > 0) setCue(activeCue(cues, v.currentTime))
    }
    const onMeta = () => setDuration(v.duration || 0)
    const onWaiting = () => setPlayState('buffering')
    const onPlaying = () => setPlayState('ready')
    const onEnded = () => {
      persistFileProgress({ completed: true })
      flushedRef.current = true // completed already recorded
      setPlaying(false)
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['continue'] })
      qc.invalidateQueries({ queryKey: ['detail', payload.type, payload.imdbId] })
      const n = nextEpRef.current
      if (isSeries && settingsRef.current?.autoplayNext && n) {
        toast.info('پخش خودکار قسمت بعدی…')
        switchEpisodeRef.current(n.season, n.episode, n.name)
      } else {
        setEnded(true)
      }
    }
    const onError = () => {
      setErrorMsg('پخش این منبع ممکن نیست')
      setPlayState('error')
    }
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('ended', onEnded)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onError)
    }
  }, [mode, cues, persistFileProgress, qc, isSeries, payload.type, payload.imdbId])

  // ——— resume (movie, native player only) ———
  useEffect(() => {
    const v = videoRef.current
    if (!v || mode !== 'file' || isSeries || resumedRef.current) return
    let target = 0
    if (typeof payload.startAt === 'number' && payload.startAt > 5) target = payload.startAt
    else {
      const p = detailQ.data?.user.progress ?? null
      if (p && p.positionSec > 5 && !p.completed && p.durationSec > 0) target = p.positionSec
    }
    if (!target) return
    const apply = () => {
      if (resumedRef.current) return
      resumedRef.current = true
      try {
        v.currentTime = target
        toast.success(`ادامه از ${fmtTime(target)}`)
      } catch {
        /* ignore */
      }
    }
    if (v.readyState >= 1) apply()
    else {
      v.addEventListener('loadedmetadata', apply, { once: true })
      return () => v.removeEventListener('loadedmetadata', apply)
    }
  }, [mode, isSeries, payload.startAt, detailQ.data])

  // ——— controls auto-hide ———
  const bumpControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }, [])
  useEffect(() => {
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3500)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const bumpEmbedControls = useCallback(() => {
    setEmbedControls(true)
    if (hideTimerEmbed.current) clearTimeout(hideTimerEmbed.current)
    hideTimerEmbed.current = setTimeout(() => setEmbedControls(false), 3000)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => bumpEmbedControls(), 0)
    return () => clearTimeout(t)
  }, [bumpEmbedControls, mode, activeSource?.id, season, episode])

  // ——— fullscreen tracking ———
  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // ——— embed load-timeout hint (iframes often never fire onload) ———
  useEffect(() => {
    iframeLoadedRef.current = false
    const t0 = setTimeout(() => {
      setIframeLoaded(false)
      setShowIframeHint(false)
    }, 0)
    if (mode !== 'embed' || !activeSource) return () => clearTimeout(t0)
    const t = setTimeout(() => {
      if (!iframeLoadedRef.current) setShowIframeHint(true)
    }, 12000)
    return () => {
      clearTimeout(t0)
      clearTimeout(t)
    }
  }, [mode, activeSource?.id, activeSource?.url])

  // ——— actions ———
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => undefined)
    else v.pause()
    bumpControls()
  }
  const seekBy = (d: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || Infinity)
    bumpControls()
  }
  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }
  const cycleSpeed = () => {
    const v = videoRef.current
    if (!v) return
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    v.playbackRate = SPEEDS[next]
    toast.info(`سرعت پخش: ${SPEEDS[next]}×`)
  }
  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shellRef.current?.requestFullscreen()
    } catch {
      toast.error('حالت تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود')
    }
  }
  const togglePip = async () => {
    const v = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v?.requestPictureInPicture?.()
    } catch {
      toast.error('تصویر‌در‌تصویر در دسترس نیست')
    }
  }
  const cycleSubSize = () => {
    setSubSize((s) => {
      const order: SubSize[] = ['sm', 'md', 'lg']
      return order[(order.indexOf(s) + 1) % order.length]
    })
  }
  const replay = () => {
    const v = videoRef.current
    if (!v) return
    flushedRef.current = false
    setEnded(false)
    v.currentTime = 0
    v.play().catch(() => undefined)
  }
  const goNextEpisode = () => {
    const n = nextEp
    if (!n) return
    switchEpisode(n.season, n.episode, n.name)
  }
  const retrySources = () => {
    setEpoch((x) => x + 1)
    void sourcesQ.refetch()
  }
  const switchServer = (id: string) => {
    if (!sources.some((s) => s.id === id) || id === activeSource?.id) return
    setServerId(id)
    setIframeLoaded(false)
    iframeLoadedRef.current = false
    setShowIframeHint(false)
    setPlayState('loading')
    setErrorMsg('')
    setEnded(false)
    if (settings) {
      useApp.getState().setSettings({ ...settings, defaultServer: id })
      api.updateSettings({ defaultServer: id }).catch(() => undefined)
    }
    toast.info('سرور تغییر کرد')
  }

  // seek bar (pointer)
  const seekFromEvent = (clientX: number) => {
    const bar = seekBarRef.current
    const v = videoRef.current
    if (!bar || !v || !v.duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    v.currentTime = ratio * v.duration
    setCurrent(v.currentTime)
  }
  const onBarPointerDown = (e: React.PointerEvent) => {
    if (locked) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    seekFromEvent(e.clientX)
  }
  const onBarPointerMove = (e: React.PointerEvent) => {
    if (locked || e.buttons === 0) return
    seekFromEvent(e.clientX)
  }

  // ——— episode history (for the in-player switcher) ———
  const epHist = useMemo(() => {
    const map = new Map<string, HistoryItemDTO>()
    for (const h of histQ.data ?? []) {
      if (h.imdbId !== payload.imdbId || h.season == null || h.episode == null) continue
      map.set(`${h.season}:${h.episode}`, h)
    }
    return map
  }, [histQ.data, payload.imdbId])

  // ——— sheet options ———
  const serverOptions: Option<string | number>[] = sources.map((s) => ({
    value: s.id,
    label: s.name,
    hint: s.kind === 'file' ? 'پخش مستقیم با پلیر داخلی' : s.note,
  }))
  const qualityOptions: Option<string | number>[] =
    levels.length > 1
      ? [{ value: -1, label: 'خودکار', hint: 'بر اساس سرعت اینترنت' }, ...levels.map((l) => ({ value: l.index, label: `${l.height}p` }))]
      : [{ value: -1, label: 'منبع واحد', hint: 'این منبع فقط یک کیفیت دارد' }]
  const audioOptions: Option<string | number>[] =
    audioTracks.length > 1
      ? audioTracks.map((t) => ({ value: t.index, label: t.name }))
      : [{ value: -1, label: audioTracks[0]?.name ?? 'صدا (اصلی)', hint: 'این منبع ترک صوتی دیگری ندارد' }]
  const subOptions: Option<string | number>[] = [
    { value: 'off', label: 'خاموش' },
    ...subTracks.map((t) => ({ value: t.id, label: t.label || t.lang, hint: 'زیرنویس فارسی CineVerse' })),
  ]

  const seLabel = isSeries ? ` — ${season === 0 ? 'ویژه' : `فصل ${season ?? 1}`} · قسمت ${episode ?? 1}` : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="پخش‌کننده CineVerse"
    >
      <div
        ref={shellRef}
        dir="rtl"
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-black sm:h-[min(880px,94vh)] sm:w-[414px] sm:rounded-[2.4rem] sm:border sm:border-white/10 sm:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]"
      >
        {/* ————————————— EMBED mode ————————————— */}
        {mode === 'embed' && activeSource && (
          <div className="relative flex-1 overflow-hidden bg-black">
            <iframe
              key={`${activeSource.id}:${activeSource.url}`}
              src={activeSource.url}
              title={`پخش ${payload.title} از ${activeSource.name}`}
              className="h-full w-full border-0 bg-black"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              onLoad={() => {
                iframeLoadedRef.current = true
                setIframeLoaded(true)
                setShowIframeHint(false)
              }}
            />

            {/* tap strip to toggle overlay chrome (kept thin so the provider's own controls stay reachable) */}
            <button
              aria-label="نمایش یا پنهان کردن کنترل‌ها"
              onClick={() => setEmbedControls((v) => !v)}
              className="absolute inset-x-0 top-0 z-10 h-14 bg-transparent"
            />

            <AnimatePresence>
              {embedControls && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none absolute inset-0 z-20"
                >
                  {/* top bar */}
                  <div
                    className="pointer-events-auto absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 pb-12 pt-3"
                    style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleClose}
                        aria-label="بستن پخش‌کننده"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-transform active:scale-90"
                      >
                        <ArrowRight className="h-5 w-5" aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-white">
                          {payload.title}
                          <span className="font-normal text-white/60">{seLabel}</span>
                        </p>
                        <p className="truncate text-[10px] text-white/45">سرور: {activeSource.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* bottom bar */}
                  <div
                    className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-12"
                    style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                  >
                    {showIframeHint && (
                      <p className="mx-auto mb-2.5 w-fit max-w-full rounded-full bg-white/10 px-3.5 py-1.5 text-center text-[10.5px] leading-4 text-white/80 backdrop-blur">
                        اگر ویدئو بارگذاری نشد، سرور دیگری را امتحان کنید
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSheet('server')}
                        className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-white/15 text-[12.5px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/25 active:scale-95"
                      >
                        <Server className="h-4 w-4 shrink-0" aria-hidden />
                        تغییر سرور
                        <span className="truncate text-white/60">({activeSource.name})</span>
                      </button>
                      {isSeries && (
                        <button
                          onClick={() => {
                            setSheetSeason(season)
                            setEpSheetOpen(true)
                          }}
                          aria-label="فهرست قسمت‌ها"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 active:scale-95"
                        >
                          <ListVideo className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ————————————— FILE mode (native player) ————————————— */}
        {mode === 'file' && (
          <>
            <div className="relative flex-1 overflow-hidden" onClick={() => !locked && bumpControls()}>
              <video
                ref={videoRef}
                className="h-full w-full bg-black object-contain"
                playsInline
                autoPlay
                preload="metadata"
                muted={muted}
              />

              {/* RTL Persian subtitle overlay */}
              {activeSub !== 'off' && cue && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[130px] z-10 flex justify-center px-6" dir="rtl">
                  <span
                    className={cn('rounded-lg bg-black/75 px-3 py-1.5 text-center font-semibold leading-7 text-white', SUB_SIZES[subSize])}
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                  >
                    {cue.text}
                  </span>
                </div>
              )}

              {(playState === 'loading' || playState === 'buffering') && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/40">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
                  <p className="text-[12px] text-white/80">{playState === 'loading' ? 'در حال بارگذاری…' : 'در حال بافر…'}</p>
                </div>
              )}

              {playState === 'error' && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 px-8 text-center">
                  <AlertTriangle className="h-10 w-10 text-[#e87c03]" aria-hidden />
                  <p className="text-[13.5px] font-bold text-white">{errorMsg || 'خطا در پخش'}</p>
                  <p className="max-w-[280px] text-[11px] leading-5 text-white/60">
                    ممکن است اینترنت قطع باشد یا منبع پخش موقتاً در دسترس نباشد. اتصال را بررسی کنید و دوباره تلاش کنید.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={retrySources}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-95"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden /> تلاش مجدد
                    </button>
                    <button onClick={handleClose} className="rounded-full bg-white/10 px-5 py-2.5 text-[12.5px] font-semibold text-white">
                      بستن
                    </button>
                  </div>
                </div>
              )}

              {/* next-episode overlay (when not auto-advancing) */}
              {ended && nextEp && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70">
                  <p className="text-[12px] text-white/70">قسمت بعدی</p>
                  <p className="text-[15px] font-black text-white">
                    {nextEp.name} <span className="text-[11px] font-normal text-white/60">(فصل {nextEp.season} · قسمت {nextEp.episode})</span>
                  </p>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={goNextEpisode}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-[13px] font-bold text-primary-foreground transition-transform active:scale-95"
                    >
                      <SkipForward className="h-4 w-4" aria-hidden /> پخش قسمت بعد
                    </button>
                    <button onClick={replay} className="rounded-full bg-white/10 px-6 py-2.5 text-[13px] font-semibold text-white">
                      تماشای مجدد
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* controls panel */}
            <div
              className={cn('relative z-40 shrink-0 bg-[#0B0D12] px-4 pb-5 pt-2 transition-all duration-300', locked && 'pointer-events-none opacity-0')}
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
              dir="rtl"
            >
              {/* top bar */}
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-elevated"
                  aria-label="بستن پخش‌کننده"
                >
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </button>
                <p className="truncate px-2 text-[12.5px] font-bold text-white/90">
                  {payload.title}
                  {seLabel && <span className="font-normal text-white/50">{seLabel}</span>}
                </p>
                <button
                  onClick={() =>
                    setLocked((l) => {
                      if (l) bumpControls()
                      else setControlsVisible(false)
                      return !l
                    })
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-elevated"
                  aria-label={locked ? 'باز کردن کنترل‌ها' : 'قفل کنترل‌ها'}
                >
                  {locked ? <Lock className="h-[18px] w-[18px] text-primary" aria-hidden /> : <Unlock className="h-[18px] w-[18px]" aria-hidden />}
                </button>
              </div>

              {/* progress row */}
              <div className="flex items-center gap-2.5 pt-1" dir="ltr">
                <span className="w-[42px] text-left text-[10.5px] text-white/80 tabular-nums">{fmtTime(current)}</span>
                <div
                  ref={seekBarRef}
                  onPointerDown={onBarPointerDown}
                  onPointerMove={onBarPointerMove}
                  className="group relative h-6 flex-1 cursor-pointer touch-none"
                  role="slider"
                  aria-label="نوار پیشرفت"
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(duration)}
                  aria-valuenow={Math.floor(current)}
                >
                  <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded bg-white/20">
                    <div className="absolute left-0 top-0 h-full rounded bg-primary" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
                  </div>
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary shadow transition-transform group-hover:scale-110"
                    style={{ left: `calc(${duration ? (current / duration) * 100 : 0}% - 6px)` }}
                  />
                </div>
                <span className="w-[42px] text-right text-[10.5px] text-white/60 tabular-nums">
                  {duration ? `-${fmtTime(Math.max(0, duration - current))}` : fmtTime(0)}
                </span>
                <button
                  onClick={cycleSpeed}
                  className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/90 tabular-nums"
                  aria-label="تغییر سرعت پخش"
                >
                  {SPEEDS[speedIdx]}x
                </button>
              </div>

              {/* main controls */}
              <div className="flex items-center justify-center gap-8 py-2.5">
                <button onClick={() => seekBy(-10)} className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform active:scale-90" aria-label="۱۰ ثانیه عقب">
                  <span className="relative flex items-center justify-center">
                    <RotateCcw className="h-7 w-7" aria-hidden />
                    <span className="absolute text-[8px] font-bold tabular-nums">10</span>
                  </span>
                </button>
                <button
                  onClick={togglePlay}
                  disabled={playState === 'loading' || playState === 'error'}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(229,9,20,0.5)] transition-transform active:scale-90 disabled:opacity-50"
                  aria-label={playing ? 'توقف' : 'پخش'}
                >
                  {playing ? <Pause className="h-6 w-6 fill-primary-foreground" aria-hidden /> : <Play className="h-6 w-6 fill-primary-foreground" aria-hidden />}
                </button>
                <button onClick={() => seekBy(10)} className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform active:scale-90" aria-label="۱۰ ثانیه جلو">
                  <span className="relative flex items-center justify-center">
                    <RotateCw className="h-7 w-7" aria-hidden />
                    <span className="absolute text-[8px] font-bold tabular-nums">10</span>
                  </span>
                </button>
              </div>

              {/* options rows */}
              <div className="mt-1 space-y-0.5">
                <OptionRow
                  icon={<Subtitles className="h-[17px] w-[17px]" aria-hidden />}
                  label="زیرنویس"
                  value={activeSub === 'off' ? 'خاموش' : subTracks.find((t) => t.id === activeSub)?.label ?? 'خاموش'}
                  onClick={() => setSheet('sub')}
                />
                {activeSub !== 'off' && (
                  <OptionRow
                    icon={<Type className="h-[17px] w-[17px]" aria-hidden />}
                    label="اندازه زیرنویس"
                    value={SUB_SIZE_FA[subSize]}
                    onClick={cycleSubSize}
                  />
                )}
                <OptionRow
                  icon={<Volume2 className="h-[17px] w-[17px]" aria-hidden />}
                  label="صدا"
                  value={audioTracks.length > 1 ? (audioTracks.find((t) => t.index === currentAudio)?.name ?? 'اصلی') : 'اصلی'}
                  onClick={() => setSheet('audio')}
                />
                <OptionRow
                  icon={<Gauge className="h-[17px] w-[17px]" aria-hidden />}
                  label="کیفیت"
                  value={currentLevel === -1 ? 'خودکار' : `${levels.find((l) => l.index === currentLevel)?.height ?? '—'}p`}
                  onClick={() => setSheet('quality')}
                />
                <OptionRow
                  icon={<Server className="h-[17px] w-[17px]" aria-hidden />}
                  label="سرور پخش"
                  value={activeSource?.name ?? '—'}
                  onClick={() => setSheet('server')}
                />
                <div className="flex gap-2 pt-1.5">
                  <IconPill onClick={toggleFs} label={fs ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}>
                    {fs ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
                  </IconPill>
                  <IconPill onClick={togglePip} label="تصویر در تصویر">
                    <PictureInPicture2 className="h-4 w-4" aria-hidden />
                  </IconPill>
                  <IconPill onClick={toggleMute} label={muted ? 'صدا روشن' : 'بی‌صدا'}>
                    {muted ? <Volume2 className="h-4 w-4 opacity-40" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                  </IconPill>
                  {isSeries && nextEp && (
                    <IconPill onClick={goNextEpisode} label="قسمت بعدی">
                      <SkipForward className="h-4 w-4" aria-hidden />
                    </IconPill>
                  )}
                </div>
              </div>

              {activeSource && (
                <p className="pt-2 text-center text-[9px] leading-4 text-white/35" dir="rtl">
                  پخش مستقیم از فایل — «{activeSource.name}»
                </p>
              )}
            </div>
          </>
        )}

        {/* ————————————— overlays ————————————— */}
        {sourcesQ.isPending && !activeSource && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-[13px] font-bold text-white/90">{payload.title}</p>
            <p className="text-[11px] text-white/50">در حال آماده‌سازی پخش…</p>
          </div>
        )}

        {sourcesQ.isError && !activeSource && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
            <AlertTriangle className="h-10 w-10 text-[#e87c03]" aria-hidden />
            <p className="text-[13.5px] font-bold text-white">خطا در دریافت فهرست سرورها</p>
            <p className="max-w-[280px] text-[11px] leading-5 text-white/60">اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={retrySources}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> تلاش مجدد
              </button>
              <button onClick={handleClose} className="rounded-full bg-white/10 px-5 py-2.5 text-[12.5px] font-semibold text-white">
                بستن
              </button>
            </div>
          </div>
        )}

        {!sourcesQ.isPending && !sourcesQ.isError && !activeSource && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
            <AlertTriangle className="h-9 w-9 text-[#e87c03]" aria-hidden />
            <p className="text-[13px] font-bold text-white">سروری برای این عنوان در دسترس نیست</p>
            <p className="max-w-[280px] text-[11px] leading-5 text-white/60">هم‌اکنون هیچ سرور پخشی پاسخ نمی‌دهد؛ بعداً دوباره تلاش کنید.</p>
            <button onClick={handleClose} className="mt-2 rounded-full bg-white/10 px-5 py-2.5 text-[12.5px] font-semibold text-white">
              بازگشت
            </button>
          </div>
        )}
      </div>

      {/* ————————————— sheets ————————————— */}
      <OptionSheet
        open={sheet === 'server'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="انتخاب سرور پخش"
        options={serverOptions}
        value={activeSource?.id ?? null}
        onSelect={(v) => switchServer(String(v))}
      />
      <OptionSheet
        open={sheet === 'quality'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="کیفیت پخش"
        options={qualityOptions}
        value={currentLevel}
        onSelect={(v) => {
          const hls = hlsRef.current
          if (hls && Number(v) !== currentLevel) {
            hls.currentLevel = Number(v)
            setCurrentLevel(Number(v))
          }
        }}
      />
      <OptionSheet
        open={sheet === 'audio'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="ترک صوتی"
        options={audioOptions}
        value={currentAudio}
        onSelect={(v) => {
          const hls = hlsRef.current
          if (hls && Number(v) !== currentAudio) {
            hls.audioTrack = Number(v)
            setCurrentAudio(Number(v))
          }
        }}
      />
      <OptionSheet
        open={sheet === 'sub'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="زیرنویس"
        options={subOptions}
        value={activeSub}
        onSelect={(v) => {
          if (v === 'off') {
            setActiveSub('off')
            setCue(null)
            return
          }
          const t = subTracks.find((x) => x.id === String(v))
          if (t) void selectSub(t)
        }}
      />

      {/* episode switcher sheet */}
      <Dialog open={epSheetOpen} onOpenChange={setEpSheetOpen}>
        <DialogContent
          className="bottom-0 top-auto h-auto max-h-[80%] translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl border-x-0 border-b-0 bg-card p-0 sm:bottom-0 sm:top-auto sm:translate-y-0 sm:w-[414px] sm:left-1/2 sm:-translate-x-1/2 sm:right-auto"
          style={{ maxWidth: 'calc(100vw - 0rem)' }}
        >
          <DialogHeader className="border-b border-border px-5 pb-3 pt-4">
            <DialogTitle className="truncate text-right text-[15px] font-bold">قسمت‌ها — {payload.title}</DialogTitle>
          </DialogHeader>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            <div className="thin-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
              {seasons.map((s) => {
                const currentSheetSeason = sheetSeason ?? season
                return (
                  <button
                    key={s.number}
                    onClick={() => setSheetSeason(s.number)}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition-colors',
                      currentSheetSeason === s.number ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s.number === 0 ? 'ویژه' : `فصل ${s.number}`}
                  </button>
                )
              })}
              {seasons.length === 0 && <p className="py-2 text-[11.5px] text-muted-foreground">در حال بارگذاری فهرست قسمت‌ها…</p>}
            </div>
            <div className="thin-scrollbar max-h-[46vh] overflow-y-auto px-2 pb-3">
              {(seasons.find((s) => s.number === (sheetSeason ?? season))?.episodes ?? []).map((ep) => {
                const sNo = sheetSeason ?? season ?? -1
                const active = ep.number === episode && sNo === season
                const h = epHist.get(`${sNo}:${ep.number}`)
                return (
                  <button
                    key={ep.key}
                    onClick={() => switchEpisode(sNo, ep.number, ep.name)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors',
                      active ? 'bg-primary/10' : 'hover:bg-elevated/60'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-black tabular-nums',
                        active ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground'
                      )}
                    >
                      {ep.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12.5px] font-semibold', active ? 'text-primary' : 'text-foreground')}>{ep.name}</span>
                      {h?.completed && (
                        <span className="mt-0.5 inline-block rounded bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary">دیده‌شده</span>
                      )}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                  </button>
                )
              })}
              {seasons.length > 0 && (seasons.find((s) => s.number === (sheetSeason ?? season))?.episodes.length ?? 0) === 0 && (
                <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">قسمتی برای این فصل ثبت نشده است.</p>
              )}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function OptionRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right transition-colors hover:bg-elevated/60">
      <span className="flex items-center gap-2.5 text-[12.5px] font-semibold text-white/90">
        <span className="text-white/70">{icon}</span>
        {label}
      </span>
      <span className="max-w-[170px] truncate text-[11px] text-muted-foreground">{value}</span>
    </button>
  )
}

function IconPill({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-elevated/70 text-white/85 transition-colors hover:bg-elevated" aria-label={label}>
      {children}
      <span className="text-[9.5px] text-white/60">{label}</span>
    </button>
  )
}
