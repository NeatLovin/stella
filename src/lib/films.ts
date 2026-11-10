// Ciné à deux : catégories de films, recherche TMDB et tirage au sort.

export interface FilmCategory {
  id: string
  name: string
  emoji: string
  blurb: string
  position: number
}

export interface Film {
  id: string
  category_id: string
  /** Titre affiché (en français une fois retrouvé sur TMDB) */
  title: string
  original_title: string | null
  year: number | null
  /** null : pas encore cherché sur TMDB ; 0 : introuvable */
  tmdb_id: number | null
  poster_path: string | null
  overview: string | null
  runtime: number | null
  letterboxd_uri: string | null
  position: number
}

export type FilmInput = Omit<Film, 'id'>

/** Infos d'un film récupérées sur TMDB */
export type FilmDetails = Pick<Film, 'title' | 'original_title' | 'year' | 'tmdb_id' | 'poster_path' | 'overview' | 'runtime'>

export interface SearchResult {
  tmdb_id: number
  title: string
  original_title: string
  year: number | null
  poster_path: string | null
}

export const posterUrl = (path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

export function letterboxdUrl(f: Pick<Film, 'letterboxd_uri' | 'tmdb_id' | 'title'>): string {
  if (f.letterboxd_uri) return f.letterboxd_uri
  if (f.tmdb_id) return `https://letterboxd.com/tmdb/${f.tmdb_id}/`
  return `https://letterboxd.com/search/films/${encodeURIComponent(f.title)}/`
}

export function formatRuntime(min: number | null | undefined): string | null {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

// ---------- TMDB ----------

const TMDB = 'https://api.themoviedb.org/3'

/** Accepte le jeton de lecture (long, « eyJ… ») ou la clé d'API courte. */
async function tmdb<T>(token: string, path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const bearer = token.length > 40
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  if (!bearer) qs.set('api_key', token)
  const res = await fetch(`${TMDB}${path}?${qs}`, {
    headers: bearer ? { Authorization: `Bearer ${token}`, accept: 'application/json' } : { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'Clé TMDB refusée' : `TMDB ${res.status}`)
  return res.json() as Promise<T>
}

interface TmdbMovie {
  id: number
  title: string
  original_title: string
  release_date?: string
  poster_path: string | null
  overview?: string
  runtime?: number | null
}

const yearOf = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null)

export async function searchFilms(token: string, query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const data = await tmdb<{ results: TmdbMovie[] }>(token, '/search/movie', { query: q, language: 'fr-FR', include_adult: 'false' })
  return data.results.slice(0, 10).map((m) => ({
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    year: yearOf(m.release_date),
    poster_path: m.poster_path,
  }))
}

export async function filmDetails(token: string, id: number): Promise<FilmDetails> {
  const m = await tmdb<TmdbMovie>(token, `/movie/${id}`, { language: 'fr-FR' })
  let overview = m.overview?.trim() || null
  if (!overview) {
    const en = await tmdb<TmdbMovie>(token, `/movie/${id}`, { language: 'en-US' }).catch(() => null)
    overview = en?.overview?.trim() || null
  }
  return {
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    year: yearOf(m.release_date),
    poster_path: m.poster_path,
    overview,
    runtime: m.runtime || null,
  }
}

/** Retrouve sur TMDB un film ajouté par son titre (et son année) ; tmdb_id 0 s'il est introuvable. */
export async function resolveFilm(token: string, f: Pick<Film, 'title' | 'year'>): Promise<FilmDetails | { tmdb_id: 0 }> {
  const find = (year?: number) =>
    tmdb<{ results: TmdbMovie[] }>(token, '/search/movie', {
      query: f.title,
      primary_release_year: year,
      language: 'fr-FR',
      include_adult: 'false',
    })
  let hits = (await find(f.year ?? undefined)).results
  if (!hits.length && f.year) hits = (await find()).results
  if (!hits.length) return { tmdb_id: 0 }
  return filmDetails(token, hits[0].id)
}

// ---------- Tirage au sort ----------

export interface DrawFilter {
  categoryId: string | null
  /** Durée maximale en minutes (les films sans durée connue restent possibles) */
  maxRuntime: number | null
}

export function eligible(films: Film[], f: DrawFilter): Film[] {
  return films.filter(
    (x) => (!f.categoryId || x.category_id === f.categoryId) && (!f.maxRuntime || !x.runtime || x.runtime <= f.maxRuntime),
  )
}

/** Un film au hasard, en évitant de retomber tout de suite sur le précédent. */
export function draw(pool: Film[], avoidId?: string | null, rand = Math.random): Film | null {
  if (!pool.length) return null
  const choices = pool.length > 1 && avoidId ? pool.filter((x) => x.id !== avoidId) : pool
  return choices[Math.floor(rand() * choices.length)]
}
