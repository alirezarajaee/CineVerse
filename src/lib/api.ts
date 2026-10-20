import type {
  SessionData, SettingsData, HomeData, DetailData, ListResponse,
  LibraryItem, HistoryItemDTO, SaveProgressPayload, SubtitleTrackDTO,
  MType, LibraryItemDTO, PlayerPayload,
} from './types'

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code = 'HTTP_ERROR'
    let message = res.status === 404 ? 'یافت نشد.' : 'خطای شبکه؛ اتصال اینترنت را بررسی کنید.'
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      if (data.error) code = data.error
      if (data.message) message = data.message
    } catch { /* non-json */ }
    throw new ApiError(code, message, res.status)
  }
  return res.json() as Promise<T>
}

function get<T>(url: string): Promise<T> {
  return fetch(url, { cache: 'no-store' }).then((r) => handle<T>(r))
}
function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r))
}

export interface LibrarySnapshot {
  imdbId: string
  type: MType
  title: string
  poster?: string | null
  year?: string | null
  rating?: number | null
}

export const api = {
  // ——— Auth ———
  session: () => get<SessionData>('/api/auth/session'),
  createGuest: () => send<{ user: SessionData['user'] }>('/api/auth/guest', 'POST'),
  register: (p: { identifier: string; password: string; name?: string }) =>
    send<{ user: SessionData['user'] }>('/api/auth/register', 'POST', p),
  login: (p: { identifier: string; password: string }) =>
    send<{ user: SessionData['user'] }>('/api/auth/login', 'POST', p),
  logout: () => send<{ success: boolean }>('/api/auth/logout', 'POST'),
  deleteAccount: () => send<{ success: boolean }>('/api/account/delete', 'POST'),
  googleStart: () => get<unknown>('/api/auth/google'),

  // ——— Metadata (live full movie/series database) ———
  home: () => get<HomeData>('/api/home'),
  search: (p: { q: string; type?: 'all' | MType; skip?: number }) => {
    const sp = new URLSearchParams({ q: p.q })
    sp.set('type', p.type ?? 'all')
    sp.set('skip', String(p.skip ?? 0))
    return get<ListResponse>(`/api/search?${sp.toString()}`)
  },
  catalog: (p: { type: MType; catalog: string; genre?: string; skip?: number }) => {
    const sp = new URLSearchParams({ type: p.type, catalog: p.catalog })
    if (p.genre) sp.set('genre', p.genre)
    sp.set('skip', String(p.skip ?? 0))
    return get<ListResponse>(`/api/catalog?${sp.toString()}`)
  },
  detail: (type: MType, imdbId: string) =>
    get<DetailData>(`/api/metadata/detail?type=${type}&imdb=${encodeURIComponent(imdbId)}`),
  subtitles: (p: { type: MType; imdbId: string; season?: number | null; episode?: number | null }) => {
    const sp = new URLSearchParams({ type: p.type, imdb: p.imdbId })
    if (p.season) sp.set('season', String(p.season))
    if (p.episode) sp.set('episode', String(p.episode))
    return get<SubtitleTrackDTO[]>(`/api/subtitles?${sp.toString()}`)
  },

  // ——— Library ———
  favorites: () => get<LibraryItem[]>('/api/library/favorites'),
  toggleFavorite: (item: LibrarySnapshot) =>
    send<{ favorite: boolean }>('/api/library/favorites', 'POST', item),
  watchlist: () => get<LibraryItem[]>('/api/library/watchlist'),
  toggleWatchlist: (item: LibrarySnapshot) =>
    send<{ watchlist: boolean }>('/api/library/watchlist', 'POST', item),

  history: () => get<HistoryItemDTO[]>('/api/library/history?mode=history'),
  continueWatching: () => get<HistoryItemDTO[]>('/api/library/history?mode=continue'),
  saveProgress: (p: SaveProgressPayload) =>
    send<{ saved: boolean }>('/api/library/history', 'POST', p),
  clearHistory: () => send<{ success: boolean }>('/api/library/history', 'DELETE'),

  searchHistory: () => get<Array<{ id: string; query: string }>>('/api/search-history'),
  recordSearch: (query: string) => send<{ saved: boolean }>('/api/search-history', 'POST', { query }),
  clearSearchHistory: () => send<{ success: boolean }>('/api/search-history', 'DELETE'),

  // ——— Settings ———
  settings: () => get<SettingsData>('/api/settings'),
  updateSettings: (patch: Partial<SettingsData>) => send<SettingsData>('/api/settings', 'PUT', patch),
}

// ——— Player navigation helper ———
export function openPlayerPayload(p: PlayerPayload): PlayerPayload {
  return p
}
