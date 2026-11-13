// Données fictives en mémoire pour développer sans Supabase (npm run demo, mot de passe « demo »).
import type { Api, Photo, Reason, ReasonAuthor, TimelineEvent, WishlistItem } from './api'
import type { Ovulation, Period } from './cycle'
import type { AdventDay, AdventKind, AdventState } from './advent'
import type { Film, FilmCategory } from './films'
import { isEmptyEntry, type SymptomEntry } from './symptoms'
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
    { id: uid(), start_date: plusDays(today, -96), end_date: plusDays(today, -92) },
    { id: uid(), start_date: plusDays(today, -68), end_date: plusDays(today, -64) },
    { id: uid(), start_date: plusDays(today, -39), end_date: plusDays(today, -35) },
    { id: uid(), start_date: plusDays(today, -11), end_date: plusDays(today, -7) },
  ]
  let ovulations: Ovulation[] = []
  // Calendrier de l'Avent : 24 cases génériques, une de chaque type au moins
  const adventKinds: AdventKind[] = [
    'mot',
    'son',
    'bon',
    'souvenir',
    'film',
    'defi',
    'mot',
    'jeu',
    'souvenir',
    'bon',
    'defi',
    'rdv',
    'bon',
    'mot',
    'quiz',
    'son',
    'souvenir',
    'bon',
    'rdv',
    'film',
    'voeu',
    'jeu',
    'mot',
    'lettre',
  ]
  const adventDays = (year: number): AdventDay[] =>
    adventKinds.map((kind, i) => ({
      date: `${year}-12-${String(i + 1).padStart(2, '0')}`,
      kind,
      title: `Case de démonstration n° ${i + 1}`,
      body: 'Texte de démonstration. Ici, un petit mot écrit pour l’occasion.\n\nUn deuxième paragraphe pour voir la mise en page.',
      extra:
        kind === 'bon'
          ? { coupon: 'un câlin de démonstration' }
          : kind === 'rdv'
            ? {
                time: '19 h 30',
                outfit: 'Chaud et confortable',
                clues: ['Premier indice de démonstration', 'Deuxième indice', 'Dernier indice'],
              }
            : kind === 'quiz'
              ? {
                  questions: [
                    { q: 'Question de démonstration ?', options: ['Réponse A', 'Réponse B', 'Réponse C'], answer: 1, comment: 'Bravo !' },
                    { q: 'Deuxième question ?', options: ['Oui', 'Non'], answer: 0 },
                  ],
                }
              : kind === 'jeu'
                ? { game: i < 10 ? 'deny' : 'jude' }
                : kind === 'film'
                  ? { film: 'Comédie de Noël' }
                  : kind === 'son'
                    ? { track: 'Morceau de démonstration' }
                    : {},
    }))
  let adventState: AdventState[] = []

  // Ciné à deux : catégories et films génériques (sans affiches : pas de TMDB en démo)
  let filmCategories: FilmCategory[] = [
    { id: 'cat-1', name: 'Classiques', emoji: '🔥', blurb: 'Catégorie de démonstration.', position: 1 },
    { id: 'cat-2', name: 'Noël', emoji: '🎄', blurb: 'Plaid et chocolat chaud.', position: 2 },
    { id: 'cat-3', name: 'À découvrir', emoji: '🌠', blurb: 'Jamais vus, ni l’un ni l’autre.', position: 3 },
    { id: 'cat-4', name: 'Romance', emoji: '💞', blurb: 'Main dans la main.', position: 4 },
    { id: 'cat-5', name: 'Horreur', emoji: '🔪', blurb: 'Sous le plaid.', position: 5 },
    { id: 'cat-6', name: 'Fous rires', emoji: '😂', blurb: 'Pour rire aux éclats.', position: 6 },
  ]
  const demoFilm = (i: number, category_id: string, title: string, year: number, runtime: number): Film => ({
    id: `film-${i}`,
    category_id,
    title,
    original_title: null,
    year,
    tmdb_id: 0,
    poster_path: null,
    overview: 'Résumé de démonstration du film, sur deux ou trois lignes pour voir la mise en page.',
    runtime,
    letterboxd_uri: null,
    position: i,
  })
  let films: Film[] = [
    ['cat-1', 'Film culte', 1994, 142],
    ['cat-1', 'Grand classique', 2008, 152],
    ['cat-1', 'Chef-d’œuvre', 1988, 124],
    ['cat-1', 'Film à twist', 2006, 130],
    ['cat-2', 'Comédie de Noël', 2003, 97],
    ['cat-2', 'Film sous la neige', 1990, 103],
    ['cat-2', 'Conte d’hiver', 2019, 96],
    ['cat-3', 'Pépite inconnue', 2013, 123],
    ['cat-3', 'Film d’animation', 1997, 134],
    ['cat-3', 'Thriller', 2016, 106],
    ...Array.from({ length: 10 }, (_, k) => ['cat-1', `Classique n° ${k + 5}`, 1990 + k, 100 + k * 5]),
    ['cat-4', 'Histoire d’amour', 2004, 123],
    ['cat-4', 'Comédie romantique', 1999, 124],
    ['cat-5', 'Maison hantée', 2013, 112],
    ['cat-5', 'Film qui fait peur', 2018, 127],
    ['cat-6', 'Comédie culte', 1993, 107],
  ].map(([c, t, y, r], i) => demoFilm(i + 1, c as string, t as string, y as number, r as number))

  // Quelques symptômes qui reviennent, pour montrer « Ce qui revient »
  let symptoms: SymptomEntry[] = [
    ...[-96, -95, -68, -67, -39, -11, -10].map((d) => ({ day: plusDays(today, d), items: ['crampes'], flow: null, note: null })),
    ...[-70, -42, -41].map((d) => ({ day: plusDays(today, d), items: ['sucre', 'fatiguee'], flow: null, note: null })),
    { day: plusDays(today, -3), items: ['bien', 'bien-dormi'], flow: null, note: null },
  ]

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
    async getMilestoneMessage(key) {
      await wait()
      return key.startsWith('days') ? 'Message de démonstration pour ce jalon.\n\nDeuxième paragraphe.' : null
    },
    async getSettings() {
      return {
        her_name: 'Elle',
        his_name: 'Lui',
        couple_start: '2026-06-20',
        welcome:
          'Premier paragraphe du mot d’accueil.\n\nDeuxième paragraphe, un peu plus long pour voir comment le texte respire sur plusieurs lignes.\n\nTroisième paragraphe.',
        flower_message:
          'Premier paragraphe de démonstration, assez court pour une phrase d’ouverture.\n\nDeuxième paragraphe de démonstration, plus long, pour vérifier que la carte tient sur un seul écran même quand le texte s’étire sur plusieurs lignes et prend de la place.\n\nTroisième paragraphe de démonstration, lui aussi assez long, avec quelques mots de plus pour approcher la longueur d’une vraie carte écrite à la main, et voir si tout reste lisible.\n\nFin.',
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
    async setWishOffered(id, offered) {
      wishlist = wishlist.map((w) => (w.id === id ? { ...w, offered } : w))
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
    async exportTables(tables) {
      const data: Record<string, unknown[]> = { reasons, timeline_events: timeline, films, film_categories: filmCategories }
      return { data, missing: tables.filter((t) => !(t in data)) }
    },
    async listFiles() {
      return []
    },
    async downloadFile() {
      return new Blob()
    },
    async getAdventDays(year) {
      // Comme Supabase : seulement les cases dont la date est passée
      const today = new Date().toISOString().slice(0, 10)
      return adventDays(year).filter((d) => d.date <= today)
    },
    async getAdventState() {
      return [...adventState]
    },
    async setAdventState(date, patch) {
      const cur = adventState.find((s) => s.date === date) ?? { date, opened_at: null, used_at: null, answer: null }
      adventState = [...adventState.filter((s) => s.date !== date), { ...cur, ...patch }]
    },
    async getFilmCategories() {
      return [...filmCategories].sort((a, b) => a.position - b.position)
    },
    async getFilms() {
      return [...films]
    },
    async addFilm(f) {
      const film = { ...f, id: uid() }
      films.push(film)
      return film
    },
    async updateFilm(id, patch) {
      films = films.map((f) => (f.id === id ? { ...f, ...patch } : f))
    },
    async deleteFilm(id) {
      films = films.filter((f) => f.id !== id)
    },
    async addFilmCategory(c) {
      const cat = { ...c, id: uid() }
      filmCategories.push(cat)
      return cat
    },
    async updateFilmCategory(id, patch) {
      filmCategories = filmCategories.map((c) => (c.id === id ? { ...c, ...patch } : c))
    },
    async deleteFilmCategory(id) {
      filmCategories = filmCategories.filter((c) => c.id !== id)
      films = films.filter((f) => f.category_id !== id)
    },
    async getTmdbToken() {
      return null
    },
    async getSymptoms() {
      return [...symptoms].sort((a, b) => a.day.localeCompare(b.day))
    },
    async saveSymptoms(entry) {
      symptoms = symptoms.filter((x) => x.day !== entry.day)
      if (!isEmptyEntry(entry)) symptoms.push({ ...entry, note: entry.note?.trim() || null })
    },
  }
}
