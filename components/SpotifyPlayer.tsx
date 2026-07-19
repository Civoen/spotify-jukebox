'use client'

import { useEffect, useRef } from 'react'
import { useJukeboxStore } from '@/lib/store'

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume: number
      }) => SpotifyPlayerInstance
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, cb: (state: unknown) => void) => void
  removeListener: (event: string) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setVolume: (vol: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
}

export interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      id: string
      name: string
      artists: { name: string }[]
      album: { name: string; images: { url: string }[] }
      duration_ms: number
      uri: string
      preview_url: string | null
      explicit: boolean
    }
  }
}

export let globalPlayer: SpotifyPlayerInstance | null = null

export default function SpotifyPlayer() {
  const { accessToken, setDeviceId, setIsPlaying, setCurrentTrack, setProgressMs, setDurationMs, skipNext } =
    useJukeboxStore()
  const playerRef = useRef<SpotifyPlayerInstance | null>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPausedRef = useRef<boolean>(true)
  const hasImportedQueue = useRef(false)

  // Queue import is intentionally deferred to the 'ready' event handler below
  // so it doesn't compete with the SDK's own internal API calls on startup.

  useEffect(() => {
    if (!accessToken) return

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Jukebox',
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.7,
      })

      playerRef.current = player
      globalPlayer = player

      player.addListener('ready', (state) => {
        const { device_id } = state as { device_id: string }
        setDeviceId(device_id)
        // Wait 2s after SDK ready before fetching queue — lets the SDK finish
        // its internal API calls so we don't contribute to rate limiting.
        if (!hasImportedQueue.current) {
          setTimeout(() => {
            if (hasImportedQueue.current) return
            const { queue, contextQueue, importQueue, accessToken: tok } = useJukeboxStore.getState()
            if (queue.length > 0 || contextQueue.length > 0) { hasImportedQueue.current = true; return }
            if (!tok) return
            import('@/lib/spotify').then(({ getSpotifyCurrentQueue }) => {
              getSpotifyCurrentQueue(tok).then((tracks) => {
                if (tracks.length > 0) { importQueue(tracks); hasImportedQueue.current = true }
              }).catch(() => {})
            })
          }, 2000)
        }
      })

      player.addListener('not_ready', () => {
        console.warn('Spotify player offline')
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) return
        const s = state as SpotifyPlaybackState
        const track = s.track_window.current_track

        // If user switched to Jukebox mid-session and we haven't imported the
        // queue yet (early fetch may have found nothing), try once more now.
        if (!hasImportedQueue.current) {
          const { queue, contextQueue, importQueue, accessToken: tok } = useJukeboxStore.getState()
          if (queue.length === 0 && contextQueue.length === 0 && tok) {
            hasImportedQueue.current = true // prevent retrying on every state change
            import('@/lib/spotify').then(({ getSpotifyCurrentQueue }) => {
              getSpotifyCurrentQueue(tok).then((tracks) => {
                if (tracks.length > 0) importQueue(tracks)
              }).catch(() => {})
            })
          }
        }

        // Auto-play next queued song when track ends naturally
        const wasPaused = prevPausedRef.current
        prevPausedRef.current = s.paused
        if (s.paused && s.position < 500 && !wasPaused) {
          const { queue: q, contextQueue: cq, skipNext: skip, accessToken: tok, deviceId: did } = useJukeboxStore.getState()
          if (q.length > 0 || cq.length > 0) {
            const next = skip()
            if (next && tok && did) {
              import('@/lib/spotify').then(({ playTrack }) => playTrack(tok, next.uri, did))
            }
          }
        }

        setIsPlaying(!s.paused)
        setProgressMs(s.position)
        setDurationMs(s.duration)
        setCurrentTrack({
          id: track.id,
          name: track.name,
          artists: (track.artists as { uri: string; name: string }[]).map((a) => ({
            id: a.uri.replace('spotify:artist:', ''),
            name: a.name,
          })),
          album: track.album as { name: string; images: { url: string; width: number; height: number }[] },
          duration_ms: track.duration_ms,
          preview_url: track.preview_url,
          uri: track.uri,
          explicit: track.explicit,
        })
      })

      player.addListener('autoplay_failed', () => {
        const next = skipNext()
        if (next) {
          import('@/lib/spotify').then(({ playTrack }) => {
            const { accessToken: tok, deviceId: did } = useJukeboxStore.getState()
            if (tok && did) playTrack(tok, next.uri, did)
          })
        }
      })

      player.connect()
    }

    return () => {
      playerRef.current?.disconnect()
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [accessToken, setDeviceId, setIsPlaying, setCurrentTrack, setProgressMs, setDurationMs, skipNext])

  // Tick progress — subscribe to isPlaying so the interval starts/stops correctly
  useEffect(() => {
    const startInterval = () => {
      if (progressInterval.current) return
      progressInterval.current = setInterval(() => {
        useJukeboxStore.setState((s) => ({
          progressMs: Math.min(s.progressMs + 250, s.durationMs),
        }))
      }, 250)
    }
    const stopInterval = () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    }

    const unsub = useJukeboxStore.subscribe((state, prev) => {
      if (state.isPlaying === prev.isPlaying) return
      if (state.isPlaying) startInterval()
      else stopInterval()
    })

    // Kick off if already playing when this effect runs
    if (useJukeboxStore.getState().isPlaying) startInterval()

    return () => {
      unsub()
      stopInterval()
    }
  }, [])

  return null
}
