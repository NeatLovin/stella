// Données fictives en mémoire pour développer sans Supabase (npm run demo, mot de passe « demo »).
import type { Api, Photo, Reason, ReasonAuthor, TimelineEvent, WishlistItem } from './api'
import type { Ovulation, Period } from './cycle'
import { plusDays, todayISO } from './dates'

const uid = () => crypto.randomUUID()
const wait = () => new Promise((r) => setTimeout(r, 150))

export function createDemoApi(): Api {
  let signedIn = false
  const listeners = new Set<(v: boolean) => void>()
  const emit = () => listeners.forEach((l) => l(signedIn))

  // Contenu générique : ce fichier finit dans le bundle public, rien de perso ici.
  const timeline: TimelineEvent[] = [
    ['2026-05-10', null, 'Premier souvenir', 'Texte de démonstration.', '👋', false],
    ['2026-06-02', '2026-06-12', 'Des vacances', 'Un souvenir qui dure plusieurs jours.', '🏖️', false],
    ['2026-06-20', null, 'Le grand jour', 'Une étoile mise en avant.', '💫', true],
    ['2026-07-04', null, 'Une fête', 'Texte de démonstration.', '🎂', false],
    [
      '2026-07-18',
      null,
      'Un premier date',
      'Texte de démonstration un peu plus long pour tester le retour à la ligne dans la carte.',
      '♨️',
      false,
    ],
    ['2026-08-09', null, 'Une sortie', 'Texte de démonstration.', '🎡', false],
    ['2026-09-01', null, 'Une victoire', 'Texte de démonstration.', '🚗', false],
    ['2026-09-21', null, 'Un nouveau venu', 'Texte de démonstration.', '🧸', false],
  ].map(([date_start, date_end, title, description, icon, highlight]) => ({
    id: uid(),
    date_start,
    date_end,
    title,
    description,
    icon,
    highlight,
    image_path: null,
    song_url: null,
  })) as TimelineEvent[]

  let reasons: Reason[] = [
    ...[
      'Première raison de démonstration.',
      'Deuxième raison, un peu plus longue, pour voir comment le texte se répartit sur plusieurs lignes.',
      'Troisième raison de démonstration.',
      'Quatrième raison de démonstration.',
    ].map((text) => ({ id: uid(), text, favorite: false, author: 'him' as ReasonAuthor })),
    ...['Une raison écrite par elle.', 'Une deuxième raison, écrite par elle aussi.'].map((text) => ({
      id: uid(),
      text,
      favorite: false,
      author: 'her' as ReasonAuthor,
    })),
  ]

  let wishlist: WishlistItem[] = [
    { id: uid(), name: 'Un plaid', url: 'https://example.com/plaid', image_path: null, created_at: new Date().toISOString() },
    { id: uid(), name: 'Une bougie', url: null, image_path: null, created_at: new Date().toISOString() },
  ]
  const images = new Map<string, string>()
  let photos: Photo[] = []

  const today = todayISO()
  let periods: Period[] = [
    { id: uid(), start_date: plusDays(today, -68), end_date: plusDays(today, -64) },
    { id: uid(), start_date: plusDays(today, -39), end_date: plusDays(today, -35) },
    { id: uid(), start_date: plusDays(today, -11), end_date: plusDays(today, -7) },
  ]
  let ovulations: Ovulation[] = []

  return {
    async getSession() {
      return signedIn ? ({} as never) : null
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signIn(password) {
      await wait()
      if (password !== 'demo') throw new Error('wrong-password')
      signedIn = true
      emit()
    },
    async signOut() {
      signedIn = false
      emit()
    },
    async getSettings() {
      return {
        her_name: 'Elle',
        his_name: 'Lui',
        couple_start: '2026-06-20',
        welcome:
          'Premier paragraphe du mot d’accueil.\n\nDeuxième paragraphe, un peu plus long pour voir comment le texte respire sur plusieurs lignes.\n\nTroisième paragraphe.',
      }
    },
    async getTimeline() {
      await wait()
      return timeline.map((e) => ({ ...e }))
    },
    async setEventSong(id, song_url) {
      const e = timeline.find((t) => t.id === id)
      if (e) e.song_url = song_url
    },
    async setEventImage(id, image_path) {
      const e = timeline.find((t) => t.id === id)
      if (e) e.image_path = image_path
    },
    async getPhotos() {
      return [...photos]
    },
    async addPhoto(image_path, caption) {
      photos = [{ id: uid(), image_path, caption, created_at: new Date().toISOString() }, ...photos]
    },
    async deletePhoto(photo) {
      photos = photos.filter((p) => p.id !== photo.id)
    },
    async getReasons() {
      await wait()
      return reasons.map((r) => ({ ...r }))
    },
    async setReasonFavorite(id, favorite) {
      const r = reasons.find((x) => x.id === id)
      if (r) r.favorite = favorite
    },
    async addReason(text, author) {
      await wait()
      const r: Reason = { id: uid(), text, favorite: false, author }
      reasons.push(r)
      return { ...r }
    },
    async updateReason(id, text) {
      const r = reasons.find((x) => x.id === id)
      if (r) r.text = text
    },
    async deleteReason(id) {
      reasons = reasons.filter((r) => r.id !== id)
    },
    async getWishlist() {
      await wait()
      return [...wishlist]
    },
    async addWish(input) {
      wishlist = [{ id: uid(), created_at: new Date().toISOString(), ...input }, ...wishlist]
    },
    async updateWish(id, input) {
      wishlist = wishlist.map((w) => (w.id === id ? { ...w, ...input } : w))
    },
    async deleteWish(item) {
      wishlist = wishlist.filter((w) => w.id !== item.id)
    },
    async uploadImage(blob, folder = 'wishlist') {
      const path = `${folder}/${uid()}.jpg`
      images.set(path, URL.createObjectURL(blob))
      return path
    },
    async deleteImage(path) {
      images.delete(path)
    },
    async imageUrls(paths) {
      return Object.fromEntries(paths.filter((p) => images.has(p)).map((p) => [p, images.get(p)!]))
    },
    async getPeriods() {
      return [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
    },
    async addPeriod(start_date, end_date = null) {
      periods = [...periods, { id: uid(), start_date, end_date }]
    },
    async updatePeriod(id, patch) {
      periods = periods.map((p) => (p.id === id ? { ...p, ...patch } : p))
    },
    async deletePeriod(id) {
      periods = periods.filter((p) => p.id !== id)
    },
    async getOvulations() {
      return [...ovulations]
    },
    async addOvulation(date) {
      ovulations = [...ovulations, { id: uid(), date }]
    },
    async deleteOvulation(id) {
      ovulations = ovulations.filter((o) => o.id !== id)
    },
  }
}
