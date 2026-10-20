// Shared API DTOs between frontend and backend — live-metadata edition

export type MType = 'movie' | 'series'

export interface MediaCard {
  imdbId: string
  type: MType
  title: string
  year: string | null
  rating: number | null
  poster: string | null
  background: string | null
  logo: string | null
  genres: string[]
  runtime: string | null
  description: string | null
}

export interface EpisodeDTO {
  key: string // "tt123:1:4"
  season: number
  number: number
  name: string
  overview: string | null
  thumb: string | null
  released: string | null
}

export interface SeasonDTO {
  number: number
  episodes: EpisodeDTO[]
}

export interface CreditDTO {
  name: string
  character: string | null
}

export interface SourceDTO {
  id: string
  name: string
  note: string
  kind: 'embed' | 'file'
  url: string
}

export interface SubtitleTrackDTO {
  id: string
  lang: string
  label: string
  url: string
  format: 'srt' | 'vtt'
}

export interface ProgressDTO { positionSec: number; durationSec: number; completed: boolean }

export interface DetailData {
  title: MediaCard & {
    awards: string | null
    country: string | null
    status: string | null
    trailer: string | null // youtube id
    moviedbId: number | null
    released: string | null
  }
  cast: CreditDTO[]
  director: string[]
  writer: string[]
  seasons: SeasonDTO[]
  sources: SourceDTO[]
  similar: MediaCard[]
  user: { favorite: boolean; watchlist: boolean; progress: ProgressDTO | null }
}

export interface RailDTO {
  key: string
  titleFa: string
  type: MType
  catalog: string
  genre: string | null
  items: MediaCard[]
  hasMore: boolean
}

export interface HomeData {
  hero: MediaCard[]
  rails: RailDTO[]
}

export interface ListResponse { items: MediaCard[]; page: number; hasMore: boolean }

export interface LibraryItemDTO {
  imdbId: string
  type: MType
  title: string
  poster: string | null
  year: string | null
  rating: number | null
  addedAt: string
}

export interface LibraryItem {
  addedAt: string
  item: LibraryItemDTO
}

export interface HistoryItemDTO {
  id: string
  imdbId: string
  type: MType
  title: string
  poster: string | null
  year: string | null
  season: number | null
  episode: number | null
  episodeTitle: string | null
  positionSec: number
  durationSec: number
  percent: number
  completed: boolean
  updatedAt: string
}

export interface SaveProgressPayload {
  imdbId: string
  type: MType
  title: string
  poster?: string | null
  year?: string | null
  season?: number | null
  episode?: number | null
  episodeTitle?: string | null
  positionSec: number
  durationSec: number
  completed?: boolean
}

export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  username: string | null
  image: string | null
  isGuest: boolean
  hasPassword: boolean
}

export interface SessionData { user: SessionUser | null; googleConfigured: boolean }

export interface SettingsData {
  uiLang: string
  subtitleLang: string
  audioLang: string
  defaultQuality: string
  defaultServer: string
  saveHistory: boolean
  dataSaver: boolean
  autoplayNext: boolean
}

export type PlayerPayload = {
  imdbId: string
  type: MType
  title: string
  poster?: string | null
  year?: string | null
  season?: number | null
  episode?: number | null
  episodeName?: string | null
  startAt?: number
  serverId?: string
}
