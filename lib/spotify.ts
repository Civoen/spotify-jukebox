const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier(length = 128): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => chars[b % chars.length]).join('')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function initiateLogin() {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('pkce_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `${SPOTIFY_AUTH_URL}?${params}`
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const verifier = sessionStorage.getItem('pkce_verifier')!
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) throw new Error('Token exchange failed')
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

// ─── Token storage ────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface StoredToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function storeToken(token: TokenResponse) {
  const stored: StoredToken = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || getStoredToken()?.refreshToken || '',
    expiresAt: Date.now() + token.expires_in * 1000 - 60_000,
  }
  localStorage.setItem('spotify_token', JSON.stringify(stored))
}

export function getStoredToken(): StoredToken | null {
  const raw = localStorage.getItem('spotify_token')
  if (!raw) return null
  return JSON.parse(raw)
}

export function clearToken() {
  localStorage.removeItem('spotify_token')
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = getStoredToken()
  if (!stored) return null

  if (Date.now() < stored.expiresAt) return stored.accessToken

  try {
    const refreshed = await refreshAccessToken(stored.refreshToken)
    storeToken(refreshed)
    return refreshed.access_token
  } catch {
    clearToken()
    return null
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function spotifyFetch<T>(path: string, token: string, retries = 3, options: RequestInit = {}, delayMs = 1000): Promise<T> {
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })

  if (res.status === 429 && retries > 0) {
    const retryAfter = res.headers.get('Retry-After')
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs
    // If Spotify wants us to wait more than 4s, fail fast so the caller can surface the error immediately
    if (waitMs > 4000) throw new Error('Spotify API error: 429 — too many requests')
    await new Promise(r => setTimeout(r, waitMs))
    return spotifyFetch(path, token, retries - 1, options, Math.min(delayMs * 2, 8000))
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Spotify API error: ${res.status} — ${body}`)
  }

  return res.json()
}

export interface SpotifyArtist {
  id: string
  name: string
  images: { url: string; width: number; height: number }[]
  followers: { total: number }
  genres: string[]
  popularity: number
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: { id: string; name: string }[]
  album: {
    name: string
    images: { url: string; width: number; height: number }[]
  }
  duration_ms: number
  preview_url: string | null
  uri: string
  explicit: boolean
}

export interface SpotifyAlbum {
  id: string
  name: string
  artists: { name: string }[]
  images: { url: string; width: number; height: number }[]
  release_date: string
  total_tracks: number
  uri: string
}

export async function searchTracks(
  query: string,
  token: string
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=track`,
    token
  )
  return data.tracks.items
}

const DECADE_RANGES: Record<string, string> = {
  '60s': '1960-1969',
  '70s': '1970-1979',
  '80s': '1980-1989',
  '90s': '1990-1999',
  '00s': '2000-2009',
}

export async function getDecadeTracks(decade: string, token: string): Promise<SpotifyTrack[]> {
  const range = DECADE_RANGES[decade]
  if (!range) return []
  const [p1, p2] = await Promise.all([
    spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
      `/search?q=year:${range}&type=track&limit=50&offset=0&market=from_token`, token
    ),
    spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
      `/search?q=year:${range}&type=track&limit=50&offset=50&market=from_token`, token
    ),
  ])
  return [...p1.tracks.items, ...p2.tracks.items].filter(Boolean)
}

const DECADE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function searchDecadeSongs(
  songs: { artist: string; title: string }[],
  token: string,
  cacheKey?: string
): Promise<SpotifyTrack[]> {
  // Return cached results if available and fresh
  if (cacheKey && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`jukebox_decade_v1_${cacheKey}`)
      if (raw) {
        const { ts, tracks } = JSON.parse(raw) as { ts: number; tracks: SpotifyTrack[] }
        if (Date.now() - ts < DECADE_CACHE_TTL && tracks.length > 0) return tracks
      }
    } catch {}
  }

  const results: SpotifyTrack[] = []
  for (const { artist, title } of songs) {
    try {
      const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
        `/search?q=track:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}&type=track&limit=1&market=from_token`,
        token
      )
      if (data.tracks.items[0]) results.push(data.tracks.items[0])
    } catch {}
    await new Promise(r => setTimeout(r, 120))
  }

  // Save to localStorage for future sessions
  if (cacheKey && typeof window !== 'undefined' && results.length > 0) {
    try {
      localStorage.setItem(`jukebox_decade_v1_${cacheKey}`, JSON.stringify({ ts: Date.now(), tracks: results }))
    } catch {}
  }

  return results
}

export async function searchAlbums(
  query: string,
  token: string,
  limit = 6
): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=album&limit=${limit}`,
    token
  )
  return data.albums.items
}

export async function searchAll(query: string, token: string): Promise<{
  tracks: SpotifyTrack[]
  artists: SpotifyArtist[]
  albums: SpotifyAlbum[]
}> {
  const data = await spotifyFetch<{
    tracks: { items: SpotifyTrack[] }
    artists: { items: SpotifyArtist[] }
    albums: { items: SpotifyAlbum[] }
  }>(`/search?q=${encodeURIComponent(query)}&type=track,artist,album&limit=10`, token)
  return {
    tracks: data.tracks.items.filter(Boolean),
    artists: data.artists.items.filter(Boolean),
    albums: data.albums.items.filter(Boolean),
  }
}

export async function getNewReleases(token: string): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
    `/search?q=tag%3Anew&type=album&limit=10`,
    token
  )
  return data.albums.items
}

export async function searchArtists(query: string, token: string): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=5`,
    token
  )
  return data.artists.items
}

export async function getArtistTopTracks(artistName: string, token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?q=${encodeURIComponent(artistName)}&type=track&limit=5`,
    token
  )
  return data.tracks.items
}

export async function getArtistAlbums(artistName: string, token: string): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
    `/search?q=${encodeURIComponent(artistName)}&type=album&limit=10`,
    token
  )
  return data.albums.items
}

export async function getAlbumTracks(albumId: string, token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: SpotifyTrack[] }>(
    `/albums/${albumId}/tracks?limit=50`,
    token
  )
  return data.items
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: { url: string }[]
  tracks: { total: number }
  owner: { display_name: string }
}

export async function getSpotifyCurrentQueue(token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ queue: SpotifyTrack[] }>('/me/player/queue', token)
  return (data.queue || []).filter(Boolean)
}

export async function getRecentlyPlayed(token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
    '/me/player/recently-played?limit=20',
    token
  )
  return data.items.map((i) => i.track).filter(Boolean)
}

export async function getUserPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    '/me/playlists?limit=20',
    token
  )
  return data.items
}

export async function getPlaylistTracks(playlistId: string, token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack | null }[] }>(
    `/playlists/${playlistId}/tracks?limit=50&market=from_token&fields=items(track(id,name,artists,album,duration_ms,uri,explicit,preview_url))`,
    token
  )
  return data.items.map((i) => i.track).filter((t): t is SpotifyTrack => t !== null)
}

export async function getUserProfile(token: string) {
  return spotifyFetch<{ display_name: string; id: string; images: { url: string }[] }>(
    '/me',
    token
  )
}

// ─── Jukebox playlist ─────────────────────────────────────────────────────────

const jukeboxPlaylistName = (year: number) => `The Outside Inn Playlist ${year}`

export async function findOrCreateJukeboxPlaylist(token: string): Promise<string> {
  const year = new Date().getFullYear()
  const name = jukeboxPlaylistName(year)

  // Search through user's playlists (up to 50) for existing playlist
  const data = await spotifyFetch<{ items: { id: string; name: string }[] }>(
    '/me/playlists?limit=50',
    token
  )
  const existing = data.items.find(p => p.name === name)
  if (existing) return existing.id

  // Create it
  const created = await spotifyFetch<{ id: string }>(
    `/me/playlists`,
    token,
    2,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: `Every track played at The Outside Inn in ${year}. Runs Jan–Jan.`,
        public: false,
      }),
    }
  )
  return created.id
}

export async function addTrackToJukeboxPlaylist(token: string, playlistId: string, trackUri: string) {
  await spotifyFetch(
    `/playlists/${playlistId}/tracks`,
    token,
    2,
    { method: 'POST', body: JSON.stringify({ uris: [trackUri] }) }
  )
}

// ─── Playback ─────────────────────────────────────────────────────────────────

export async function playTrack(token: string, uri: string, deviceId: string) {
  await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [uri] }),
  })
}

export async function previousTrack(token: string, deviceId?: string) {
  const qs = deviceId ? `?device_id=${deviceId}` : ''
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player/previous${qs}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => '')
    throw new Error(`previousTrack failed: ${res.status} — ${body}`)
  }
}

export async function pausePlayback(token: string) {
  await fetch(`${SPOTIFY_API_BASE}/me/player/pause`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function resumePlayback(token: string) {
  await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function seekTo(token: string, positionMs: number) {
  await fetch(`${SPOTIFY_API_BASE}/me/player/seek?position_ms=${positionMs}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function getAlbumArt(track: SpotifyTrack, size: 'sm' | 'md' | 'lg' = 'md'): string {
  const images = track.album.images ?? []
  if (!images.length) return '/placeholder.svg'
  if (size === 'lg') return images[0]?.url || images[images.length - 1]?.url || '/placeholder.svg'
  if (size === 'sm') return images[images.length - 1]?.url || images[0]?.url || '/placeholder.svg'
  return images[1]?.url || images[0]?.url || '/placeholder.svg'
}
