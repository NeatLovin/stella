import { afterEach, describe, expect, it, vi } from 'vitest'
import { draw, eligible, formatRuntime, letterboxdUrl, resolveFilm, type Film } from './films'

const film = (id: string, category_id: string, runtime: number | null): Film => ({
  id,
  category_id,
  title: id,
  original_title: null,
  year: 2000,
  tmdb_id: null,
  poster_path: null,
  overview: null,
  runtime,
  letterboxd_uri: null,
  position: 0,
})

const films = [film('a', 'noel', 95), film('b', 'noel', 150), film('c', 'classic', 120), film('d', 'classic', null)]

describe('tirage au sort', () => {
  it('filtre par catégorie et par durée, en gardant les durées inconnues', () => {
    expect(eligible(films, { categoryId: 'noel', maxRuntime: null }).map((f) => f.id)).toEqual(['a', 'b'])
    expect(eligible(films, { categoryId: null, maxRuntime: 125 }).map((f) => f.id)).toEqual(['a', 'c', 'd'])
  })

  it('évite de retomber sur le même film', () => {
    const pool = films.slice(0, 2)
    for (let i = 0; i < 20; i++) expect(draw(pool, 'a')?.id).toBe('b')
    expect(draw([films[0]], 'a')?.id).toBe('a')
    expect(draw([])).toBeNull()
  })
})

describe('affichage', () => {
  it('formate la durée', () => {
    expect(formatRuntime(95)).toBe('1 h 35')
    expect(formatRuntime(45)).toBe('45 min')
    expect(formatRuntime(null)).toBeNull()
  })

  it('choisit le meilleur lien Letterboxd', () => {
    expect(letterboxdUrl({ letterboxd_uri: 'https://boxd.it/x', tmdb_id: 1, title: 'A' })).toBe('https://boxd.it/x')
    expect(letterboxdUrl({ letterboxd_uri: null, tmdb_id: 27205, title: 'A' })).toBe('https://letterboxd.com/tmdb/27205/')
    expect(letterboxdUrl({ letterboxd_uri: null, tmdb_id: 0, title: 'La Haine' })).toBe('https://letterboxd.com/search/films/La%20Haine/')
  })
})

describe('TMDB', () => {
  const calls: { url: string; auth: string | null }[] = []
  const mockFetch = (responses: Record<string, unknown>) =>
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null })
      const path = new URL(url).pathname.replace('/3', '')
      const key = Object.keys(responses).find((k) => path === k) ?? ''
      return new Response(JSON.stringify(responses[key] ?? { results: [] }), { status: responses[key] ? 200 : 200 })
    })

  afterEach(() => {
    calls.length = 0
    vi.unstubAllGlobals()
  })

  it('retrouve un film par son titre et récupère les détails en français', async () => {
    mockFetch({
      '/search/movie': {
        results: [{ id: 27205, title: 'Inception', original_title: 'Inception', release_date: '2010-07-15', poster_path: '/p.jpg' }],
      },
      '/movie/27205': {
        id: 27205,
        title: 'Inception',
        original_title: 'Inception',
        release_date: '2010-07-15',
        poster_path: '/p.jpg',
        overview: 'Dom Cobb…',
        runtime: 148,
      },
    })
    const token = 'eyJ' + 'x'.repeat(60)
    const d = await resolveFilm(token, { title: 'Inception', year: 2010 })
    expect(d).toMatchObject({ tmdb_id: 27205, runtime: 148, overview: 'Dom Cobb…', year: 2010 })
    expect(calls[0].url).toContain('primary_release_year=2010')
    expect(calls[0].url).toContain('language=fr-FR')
    expect(calls[0].auth).toBe(`Bearer ${token}`)
  })

  it('accepte aussi la clé courte, et marque 0 si introuvable', async () => {
    mockFetch({})
    const d = await resolveFilm('abc123', { title: 'Film qui n’existe pas', year: 1999 })
    expect(d).toEqual({ tmdb_id: 0 })
    expect(calls).toHaveLength(2) // avec puis sans l'année
    expect(calls[0].url).toContain('api_key=abc123')
    expect(calls[0].auth).toBeNull()
  })
})
