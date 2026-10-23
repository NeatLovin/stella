import { describe, expect, it } from 'vitest'
import { parseSpotify, spotifyEmbedUrl, spotifyOpenUrl } from './spotify'

const ID = '4uLU6hMCjMI75M1A2tKUQC'

describe('parseSpotify', () => {
  it('reads share links, with or without tracking params and locale', () => {
    expect(parseSpotify(`https://open.spotify.com/track/${ID}?si=abc123`)).toEqual({ kind: 'track', id: ID })
    expect(parseSpotify(`https://open.spotify.com/intl-fr/track/${ID}`)).toEqual({ kind: 'track', id: ID })
    expect(parseSpotify(`  https://open.spotify.com/playlist/${ID}  `)).toEqual({ kind: 'playlist', id: ID })
    expect(parseSpotify(`https://open.spotify.com/embed/album/${ID}`)).toEqual({ kind: 'album', id: ID })
  })

  it('reads spotify URIs', () => {
    expect(parseSpotify(`spotify:track:${ID}`)).toEqual({ kind: 'track', id: ID })
  })

  it('rejects anything else', () => {
    expect(parseSpotify('https://spotify.link/abcdef')).toBeNull()
    expect(parseSpotify('https://youtube.com/watch?v=x')).toBeNull()
    expect(parseSpotify('')).toBeNull()
    expect(parseSpotify(null)).toBeNull()
  })

  it('builds clean URLs', () => {
    const ref = { kind: 'track' as const, id: ID }
    expect(spotifyOpenUrl(ref)).toBe(`https://open.spotify.com/track/${ID}`)
    expect(spotifyEmbedUrl(ref)).toContain(`/embed/track/${ID}`)
  })
})
