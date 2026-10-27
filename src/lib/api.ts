import { createClient, type Session } from '@supabase/supabase-js'
import type { Ovulation, Period } from './cycle'
import type { ISODate } from './dates'
import { createDemoApi } from './demo'

export interface Settings {
  her_name: string
  his_name: string
  couple_start: ISODate
  /** Mot d'accueil affiché après la connexion (paragraphes séparés par une ligne vide) */
  welcome: string
}

export interface TimelineEvent {
  id: string
  date_start: ISODate
  date_end: ISODate | null
  title: string
  description: string
  icon: string
  highlight: boolean
  image_path: string | null
  /** Lien Spotify (morceau, album ou playlist) */
  song_url: string | null
}

/** Qui a écrit la raison : lui (pour elle) ou elle (pour lui) */
export type ReasonAuthor = 'him' | 'her'

export interface Reason {
  id: string
  text: string
  favorite: boolean
  author: ReasonAuthor
}

export interface Photo {
  id: string
  image_path: string
  caption: string | null
  created_at: string
}

export interface WishlistItem {
  id: string
  name: string
  url: string | null
  image_path: string | null
  created_at: string
}

export type WishlistInput = { name: string; url: string | null; image_path: string | null }

export interface Api {
  getSession(): Promise<Session | null>
  onAuthChange(cb: (signedIn: boolean, event?: string) => void): () => void
  signIn(password: string): Promise<void>
  signOut(): Promise<void>

  getSettings(): Promise<Settings>
  getTimeline(): Promise<TimelineEvent[]>
  setEventImage(id: string, image_path: string | null): Promise<void>
  setEventSong(id: string, song_url: string | null): Promise<void>
  getReasons(): Promise<Reason[]>
  setReasonFavorite(id: string, favorite: boolean): Promise<void>
  addReason(text: string, author: ReasonAuthor): Promise<Reason>
  updateReason(id: string, text: string): Promise<void>
  deleteReason(id: string): Promise<void>

  getPhotos(): Promise<Photo[]>
  addPhoto(image_path: string, caption: string | null): Promise<void>
  deletePhoto(photo: Photo): Promise<void>

  getWishlist(): Promise<WishlistItem[]>
  addWish(input: WishlistInput): Promise<void>
  updateWish(id: string, input: WishlistInput): Promise<void>
  deleteWish(item: WishlistItem): Promise<void>
  uploadImage(blob: Blob, folder?: 'wishlist' | 'timeline' | 'photos'): Promise<string>
  deleteImage(path: string): Promise<void>
  imageUrls(paths: string[]): Promise<Record<string, string>>

  getPeriods(): Promise<Period[]>
  addPeriod(start: ISODate, end?: ISODate | null): Promise<void>
  updatePeriod(id: string, patch: Partial<Pick<Period, 'start_date' | 'end_date'>>): Promise<void>
  deletePeriod(id: string): Promise<void>
  getOvulations(): Promise<Ovulation[]>
  addOvulation(date: ISODate): Promise<void>
  deleteOvulation(id: string): Promise<void>
}

const BUCKET = 'wishlist'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

function createSupabaseApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  const email = import.meta.env.VITE_LOGIN_EMAIL
  if (!url || !key || !email) {
    throw new Error('Configuration manquante : VITE_SUPABASE_URL, VITE_SUPABASE_KEY et VITE_LOGIN_EMAIL.')
  }
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  return {
    async getSession() {
      return (await sb.auth.getSession()).data.session
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => cb(Boolean(session), event))
      return () => data.subscription.unsubscribe()
    },
    async signIn(password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message.includes('Invalid') ? 'wrong-password' : error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async getSettings() {
      const rows = check(await sb.from('settings').select('key, value')) as { key: string; value: string }[]
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      return {
        her_name: map.her_name ?? '',
        his_name: map.his_name ?? '',
        couple_start: map.couple_start ?? '2026-07-30',
        welcome: map.welcome ?? '',
      }
    },
    async getTimeline() {
      return check(await sb.from('timeline_events').select('*').order('date_start').order('created_at')) as TimelineEvent[]
    },
    async setEventImage(id, image_path) {
      check(await sb.from('timeline_events').update({ image_path }).eq('id', id))
    },
    async setEventSong(id, song_url) {
      check(await sb.from('timeline_events').update({ song_url }).eq('id', id))
    },
    async getPhotos() {
      return check(await sb.from('photos').select('*').order('created_at', { ascending: false })) as Photo[]
    },
    async addPhoto(image_path, caption) {
      check(await sb.from('photos').insert({ image_path, caption }))
    },
    async deletePhoto(photo) {
      check(await sb.from('photos').delete().eq('id', photo.id))
      await sb.storage.from(BUCKET).remove([photo.image_path])
    },
    async getReasons() {
      return check(await sb.from('reasons').select('id, text, favorite, author').order('created_at')) as Reason[]
    },
    async setReasonFavorite(id, favorite) {
      check(await sb.from('reasons').update({ favorite }).eq('id', id))
    },
    async addReason(text, author) {
      return check(await sb.from('reasons').insert({ text, author }).select('id, text, favorite, author').single()) as Reason
    },
    async updateReason(id, text) {
      check(await sb.from('reasons').update({ text }).eq('id', id))
    },
    async deleteReason(id) {
      check(await sb.from('reasons').delete().eq('id', id))
    },

    async getWishlist() {
      return check(await sb.from('wishlist_items').select('*').order('created_at', { ascending: false })) as WishlistItem[]
    },
    async addWish(input) {
      check(await sb.from('wishlist_items').insert(input))
    },
    async updateWish(id, input) {
      check(await sb.from('wishlist_items').update(input).eq('id', id))
    },
    async deleteWish(item) {
      check(await sb.from('wishlist_items').delete().eq('id', item.id))
      if (item.image_path) await sb.storage.from(BUCKET).remove([item.image_path])
    },
    async uploadImage(blob, folder = 'wishlist') {
      const path = `${folder}/${crypto.randomUUID()}.jpg`
      check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      return path
    },
    async deleteImage(path) {
      await sb.storage.from(BUCKET).remove([path])
    },
    async imageUrls(paths) {
      if (!paths.length) return {}
      const data = check(await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6)) ?? []
      const out: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
      return out
    },

    async getPeriods() {
      return check(await sb.from('periods').select('id, start_date, end_date').order('start_date')) as Period[]
    },
    async addPeriod(start_date, end_date = null) {
      check(await sb.from('periods').insert({ start_date, end_date }))
    },
    async updatePeriod(id, patch) {
      check(await sb.from('periods').update(patch).eq('id', id))
    },
    async deletePeriod(id) {
      check(await sb.from('periods').delete().eq('id', id))
    },
    async getOvulations() {
      return check(await sb.from('ovulations').select('id, date').order('date')) as Ovulation[]
    },
    async addOvulation(date) {
      check(await sb.from('ovulations').insert({ date }))
    },
    async deleteOvulation(id) {
      check(await sb.from('ovulations').delete().eq('id', id))
    },
  }
}

export const isDemo = import.meta.env.VITE_DEMO === '1'

/** Message d'erreur si les variables Supabase manquent au build (affiché par App au lieu d'une page blanche). */
export let configError: string | null = null

function createApi(): Api {
  if (isDemo) return createDemoApi()
  try {
    return createSupabaseApi()
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e)
    return new Proxy({} as Api, {
      get: () => () => Promise.reject(new Error(configError!)),
    })
  }
}

export const api: Api = createApi()
