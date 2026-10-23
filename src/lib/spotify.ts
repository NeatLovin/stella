export type SpotifyKind = 'track' | 'album' | 'playlist' | 'episode'

export interface SpotifyRef {
  kind: SpotifyKind
  id: string
}

/**
 * Reconnaît un lien Spotify (copié via « Partager → Copier le lien ») ou un URI spotify:track:…
 * Retourne null si le lien n'est pas exploitable (ex. lien raccourci spotify.link).
 */
export function parseSpotify(input: string | null | undefined): SpotifyRef | null {
  if (!input) return null
  const v = input.trim()
  const uri = v.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]{22})$/)
  if (uri) return { kind: uri[1] as SpotifyKind, id: uri[2] }
  const url = v.match(
    /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{22})/i,
  )
  if (url) return { kind: url[1].toLowerCase() as SpotifyKind, id: url[2] }
  return null
}

export const spotifyOpenUrl = ({ kind, id }: SpotifyRef) => `https://open.spotify.com/${kind}/${id}`
export const spotifyEmbedUrl = ({ kind, id }: SpotifyRef) => `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`
