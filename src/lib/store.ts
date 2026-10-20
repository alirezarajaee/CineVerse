'use client'

import { create } from 'zustand'
import type { SessionUser, SettingsData, PlayerPayload } from './types'

export type Tab = 'home' | 'search' | 'library' | 'profile'

export type Screen =
  | { name: 'tabs' }
  | { name: 'detail'; imdbId: string; type: 'movie' | 'series' }
  | { name: 'catalog'; type: 'movie' | 'series'; catalog: string; genre?: string; label: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'history' }
  | { name: 'continue' }

interface NavState {
  stack: Screen[]
  tab: Tab
  push: (s: Screen) => void
  pop: () => void
  setTab: (t: Tab) => void
  resetToTabs: (t?: Tab) => void
  canPop: () => boolean
}

export const useNav = create<NavState>((set, get) => ({
  stack: [],
  tab: 'home',
  push: (s) => set((st) => ({ stack: [...st.stack, s] })),
  pop: () => set((st) => ({ stack: st.stack.slice(0, -1) })),
  setTab: (t) => set({ tab: t, stack: [] }),
  resetToTabs: (t) => set({ tab: t ?? 'home', stack: [] }),
  canPop: () => get().stack.length > 0,
}))

interface PlayerState {
  open: boolean
  payload: PlayerPayload | null
  openPlayer: (p: PlayerPayload) => void
  closePlayer: () => void
}

export const usePlayer = create<PlayerState>((set) => ({
  open: false,
  payload: null,
  openPlayer: (p) => set({ open: true, payload: p }),
  closePlayer: () => set({ open: false, payload: null }),
}))

interface AppState {
  booted: boolean
  phase: 'splash' | 'welcome' | 'app'
  sessionUser: SessionUser | null
  googleConfigured: boolean
  settings: SettingsData | null
  setBooted: (b: boolean) => void
  setPhase: (p: 'splash' | 'welcome' | 'app') => void
  setSession: (u: SessionUser | null, googleConfigured?: boolean) => void
  setSettings: (s: SettingsData | null) => void
}

export const useApp = create<AppState>((set) => ({
  booted: false,
  phase: 'splash',
  sessionUser: null,
  googleConfigured: false,
  settings: null,
  setBooted: (b) => set({ booted: b }),
  setPhase: (p) => set({ phase: p }),
  setSession: (u, googleConfigured) =>
    set((st) => ({ sessionUser: u, googleConfigured: googleConfigured ?? st.googleConfigured })),
  setSettings: (s) => set({ settings: s }),
}))
