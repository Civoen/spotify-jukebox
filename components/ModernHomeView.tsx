'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useJukeboxStore } from '@/lib/store'
import {
  clearToken, formatDuration, searchDecadeSongs, searchGenreSongs, searchAll, getArtistsByIds,
  previousTrack as prevTrackApi, findOrCreateJukeboxPlaylist, addTrackToJukeboxPlaylist,
  playTrack, getAlbumArt,
  type SpotifyTrack, type SpotifyArtist, type SpotifyAlbum,
} from '@/lib/spotify'
import { DECADE_SONGS } from '@/lib/decade-tracks'
import { GENRES } from '@/lib/genres'
import { globalPlayer } from './SpotifyPlayer'

const MODERN_GENRES = GENRES.filter(g =>
  ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Dance', 'Electronic', 'Metal'].includes(g.label)
)
const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'] as const

/* ─── Switch design icon — two curved arrows, sits where Insert Coin used to be ─── */
function SwitchDesignIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 8a7 7 0 0 1 12-4.5M18 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14a7 7 0 0 1-12 4.5M4 18v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Sleek glass-panel style shared by every box in the Modern view — a
// glowing neon outline, brighter than before, colored per-box to form a
// pink (left) → light blue (right) gradient across the whole layout.
function glassPanel(color: string) {
  return {
    borderRadius: 20,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
    border: `1.5px solid ${color}`,
    boxShadow: `0 0 6px ${color}, 0 0 26px ${color}, 0 0 60px ${color}, 0 0 100px ${color}66, inset 0 1px 0 rgba(255,255,255,0.06)`,
  } as React.CSSProperties
}

// Deterministic pseudo-random bar heights, seeded by track id — the shape
// stays consistent for a given song rather than jittering on every render,
// but differs from song to song since Spotify doesn't expose real waveform data.
function seededBars(seed: string, count: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  let s = h || 1
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) >>> 0
    bars.push(0.22 + ((s >>> 8) % 1000) / 1000 * 0.78)
  }
  return bars
}

const BAR_COUNT = 72

function Waveform({ track, isPlaying, progress }: { track: SpotifyTrack | null; isPlaying: boolean; progress: number }) {
  const bars = useMemo(() => seededBars(track?.id ?? 'idle', BAR_COUNT), [track?.id])
  const art = track?.album.images?.[0]?.url

  return (
    <div style={{
      width: '100%', maxWidth: 1000, margin: '4px auto 20px', borderRadius: 30,
      padding: 2, flexShrink: 0,
      background: 'linear-gradient(to right, #ff2d78, #b450dc, #4ee0ff)',
      boxShadow: '-10px 0 55px rgba(255,45,120,0.5), 10px 0 55px rgba(78,224,255,0.5), 0 0 35px rgba(255,255,255,0.1)',
    }}>
    <div style={{
      width: '100%', height: 260, borderRadius: 28, overflow: 'hidden', position: 'relative',
    }}>
      {art ? (
        <img src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(50px) brightness(0.45) saturate(1.5)', transform: 'scale(1.3)' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(255,45,120,0.22), transparent 60%), #0d0710' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,10,0.25) 0%, rgba(8,6,10,0.75) 75%, #08060a 100%)' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '0 32px' }}>
        {bars.map((h, i) => {
          const isPast = i / bars.length <= progress / 100
          return (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                minWidth: 2,
                height: `${h * 100}%`,
                borderRadius: 3,
                background: isPast ? 'linear-gradient(180deg, #ff8ac0, #ff2d78)' : 'rgba(255,255,255,0.14)',
                boxShadow: isPast ? '0 0 10px rgba(255,45,120,0.45)' : 'none',
                animation: isPlaying ? `equalizer ${0.55 + (i % 5) * 0.14}s ease-in-out ${(i % 9) * 0.07}s infinite` : 'none',
              }}
            />
          )
        })}
      </div>
    </div>
    </div>
  )
}

export default function ModernHomeView() {
  const {
    accessToken, deviceId, setActiveView, setActiveArtist, setActiveAlbum,
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs, skipNext, addToQueue,
    playHistory, addToHistory, incrementPopularity, popularity,
    setKeyboardVisible, setOnKeyPress, setUiTheme, setFullscreenOpen,
  } = useJukeboxStore()

  const [loadingDecade, setLoadingDecade] = useState<string | null>(null)
  const [loadingGenre, setLoadingGenre] = useState<string | null>(null)
  const [inlineQuery, setInlineQuery] = useState('')
  const inlineQueryRef = useRef('')
  const jukeboxPlaylistId = useRef<string | null>(null)

  // Inline search dropdown — same behavior as the Standard theme
  const [inlineDropdown, setInlineDropdown] = useState<{ type: 'track' | 'artist' | 'album'; item: SpotifyTrack | SpotifyArtist | SpotifyAlbum }[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const inlineDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track play history + popularity locally, same as the Standard theme
  useEffect(() => {
    if (!currentTrack || !accessToken) return
    addToHistory(currentTrack)
    incrementPopularity(currentTrack)
    const uri = currentTrack.uri
    const addToYearlyPlaylist = async () => {
      if (!jukeboxPlaylistId.current) {
        jukeboxPlaylistId.current = await findOrCreateJukeboxPlaylist(accessToken).catch(() => null)
      }
      if (jukeboxPlaylistId.current) {
        addTrackToJukeboxPlaylist(accessToken, jukeboxPlaylistId.current, uri).catch(() => {})
      }
    }
    addToYearlyPlaylist()
  }, [currentTrack?.id, accessToken])

  // Debounced live search, mirrors the Standard theme's inline dropdown behavior
  useEffect(() => {
    if (inlineDebounce.current) clearTimeout(inlineDebounce.current)
    if (!inlineQuery.trim() || inlineQuery.length < 2 || !accessToken) {
      setInlineDropdown([])
      setSearchError('')
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    setSearchError('')
    inlineDebounce.current = setTimeout(async () => {
      try {
        const { tracks, artists, albums } = await searchAll(inlineQuery, accessToken)
        const pool: typeof inlineDropdown = []
        for (let i = 0; i < 3; i++) {
          if (tracks[i]) pool.push({ type: 'track', item: tracks[i] })
          if (artists[i]) pool.push({ type: 'artist', item: artists[i] })
          if (albums[i]) pool.push({ type: 'album', item: albums[i] })
        }
        setInlineDropdown(pool.slice(0, 3))
        setSearchError(pool.length === 0 ? 'No results found' : '')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Search failed'
        setSearchError(msg.includes('429') ? 'Rate limited — retrying…' : 'Search failed')
        setInlineDropdown([])
      } finally {
        setSearchLoading(false)
      }
    }, 1600)
    return () => { if (inlineDebounce.current) clearTimeout(inlineDebounce.current) }
  }, [inlineQuery, accessToken])

  const handleInlineSelect = (entry: typeof inlineDropdown[0]) => {
    setInlineQuery('')
    inlineQueryRef.current = ''
    setInlineDropdown([])
    if (entry.type === 'artist') {
      const a = entry.item as SpotifyArtist
      setActiveArtist({ id: a.id, name: a.name, imageUrl: a.images?.[0]?.url })
      setActiveView('artist')
    } else if (entry.type === 'album') {
      const al = entry.item as SpotifyAlbum
      setActiveAlbum(al)
      setActiveView('album')
    } else {
      const t = entry.item as SpotifyTrack
      if (!currentTrack && accessToken && deviceId) {
        playTrack(accessToken, t.uri, deviceId)
      } else {
        addToQueue(t)
      }
    }
  }

  const handleDecadePlay = async (decade: string) => {
    if (!accessToken || loadingDecade) return
    setLoadingDecade(decade)
    try {
      const songs = DECADE_SONGS[decade] ?? []
      const tracks = await searchDecadeSongs(songs, accessToken, decade)
      if (!tracks.length) return
      const shuffled = [...tracks]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      const { currentTrack: ct, deviceId: did, setContextQueue } = useJukeboxStore.getState()
      if (ct) {
        setContextQueue(shuffled)
      } else if (did) {
        setContextQueue(shuffled.slice(1))
        playTrack(accessToken, shuffled[0].uri, did)
      } else {
        setContextQueue(shuffled)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDecade(null)
    }
  }

  const handleGenreClick = async (label: string) => {
    if (!accessToken || loadingGenre) return
    setLoadingGenre(label)
    try {
      const tracks = await searchGenreSongs(label, accessToken)
      if (!tracks.length) return
      const shuffled = [...tracks]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      const { currentTrack: ct, deviceId: did, setContextQueue } = useJukeboxStore.getState()
      if (ct) {
        setContextQueue(shuffled)
      } else if (did) {
        setContextQueue(shuffled.slice(1))
        playTrack(accessToken, shuffled[0].uri, did)
      } else {
        setContextQueue(shuffled)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingGenre(null)
    }
  }

  const togglePlay = () => {
    if (isPlaying) globalPlayer?.pause(); else globalPlayer?.resume()
    setIsPlaying(!isPlaying)
  }
  const handleSkip = () => {
    const next = skipNext()
    if (next && accessToken && deviceId) playTrack(accessToken, next.uri, deviceId)
    else if (next) globalPlayer?.nextTrack()
  }
  const handlePrev = () => {
    if (accessToken) {
      prevTrackApi(accessToken, deviceId ?? undefined).catch(() => globalPlayer?.previousTrack())
    } else {
      globalPlayer?.previousTrack()
    }
  }

  const progress = durationMs > 0 ? (progressMs / durationMs) * 100 : 0
  const albumArt = currentTrack?.album.images?.[0]?.url

  const mostPopular = Object.values(popularity)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(p => p.track)

  // Aggregate play counts by artist (primary artist of each played track),
  // so "Popular Artists" reflects who's actually been played most on this jukebox.
  const topArtistIds = useMemo(() => {
    const counts: Record<string, { id: string; name: string; count: number }> = {}
    for (const { track, count } of Object.values(popularity)) {
      const artist = track.artists[0]
      if (!artist) continue
      if (!counts[artist.id]) counts[artist.id] = { id: artist.id, name: artist.name, count: 0 }
      counts[artist.id].count += count
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(a => a.id)
  }, [popularity])

  const [popularArtists, setPopularArtists] = useState<SpotifyArtist[]>([])
  useEffect(() => {
    if (!accessToken || topArtistIds.length === 0) { setPopularArtists([]); return }
    let cancelled = false
    // Staggered like the queue-import in SpotifyPlayer.tsx — avoids firing at
    // the exact same instant as other track-change-triggered API calls
    // (history, popularity, playlist-add), which can collide and rate-limit.
    const timer = setTimeout(() => {
      getArtistsByIds(topArtistIds, accessToken).then((artists) => {
        if (!cancelled) {
          // Preserve the popularity ranking order (the API doesn't guarantee it)
          const byId = new Map(artists.map(a => [a.id, a]))
          setPopularArtists(topArtistIds.map(id => byId.get(id)).filter((a): a is SpotifyArtist => !!a))
        }
      }).catch(() => { if (!cancelled) setPopularArtists([]) })
    }, 2500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [topArtistIds.join(','), accessToken])

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--retro-cream)', background: 'radial-gradient(ellipse at 50% 0%, rgba(80,20,60,0.15) 0%, transparent 55%), #08060a' }}>

      {/* ── Top bar — matches the Standard theme's height exactly, so the header/title land in the same vertical position on both views ── */}
      <div style={{ height: 10, background: 'linear-gradient(90deg, #ff2d78 0%, #ff8fc4 25%, #ffffff 50%, #4ee0ff 75%, #00d4ff 100%)', opacity: 0.8, flexShrink: 0 }} />
      <div style={{ display: 'flex', height: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #ff2d7855, transparent)' }} />
        <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #ffffff33, transparent)' }} />
        <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #00d4ff55, transparent)' }} />
      </div>

      {/* ── Header — same grid + padding as the Standard theme, so both buttons land in identical positions, with the title between them like Standard ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        <button
          onClick={() => setUiTheme('retro')}
          aria-label="Switch to Standard design"
          style={{ justifySelf: 'start', color: 'rgba(255,255,255,0.5)', padding: 8 }}
        >
          <SwitchDesignIcon />
        </button>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <p style={{ fontSize: 16, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 500 }}>Welcome To</p>
          <h1 style={{
            fontSize: 56, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.05, color: '#fff',
            textShadow: '0 0 14px rgba(255,45,120,0.55), 0 0 40px rgba(255,45,120,0.3)',
          }}>
            The Outside Inn Jukebox
          </h1>
        </div>
        <button onClick={() => { clearToken(); window.location.reload() }} style={{ justifySelf: 'end', color: 'rgba(255,255,255,0.4)', padding: 8 }}>
          <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Waveform hero ── */}
      <Waveform track={currentTrack} isPlaying={isPlaying} progress={progress} />

      <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>

        <div className="grid grid-cols-[260px_1fr_260px] gap-4 max-w-[1000px] mx-auto" style={{ padding: '18px 16px 24px' }}>

          {/* Genres panel */}
          <div style={{ ...glassPanel('rgba(255,45,120,0.65)'), padding: '20px 18px' }}>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: '#ff6bb0', marginBottom: 14 }}>GENRES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MODERN_GENRES.map((g) => {
                const isLoading = loadingGenre === g.label
                return (
                  <button key={g.label} onClick={() => handleGenreClick(g.label)} disabled={!!loadingGenre}
                    className="active:scale-[0.97] transition-transform"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '15px 12px',
                      borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #ff2d78, #ff6bb0)',
                      boxShadow: '0 0 16px rgba(255,45,120,0.5)',
                      opacity: loadingGenre && !isLoading ? 0.35 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                    {isLoading
                      ? <span className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                      : <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{g.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Now Playing panel */}
          <div style={{ ...glassPanel('rgba(180,80,220,0.6)'), padding: '22px 24px' }}>
            <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 16, fontWeight: 600 }}>Now Playing</p>

            <div onClick={() => setFullscreenOpen(true)} style={{ width: 190, height: 190, margin: '0 auto 16px', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              {albumArt
                ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: '#fff' }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>}
            </div>

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: '#fff' }}>{currentTrack?.name ?? 'No track playing'}</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                {currentTrack ? currentTrack.artists.map((a, i) => (
                  <span key={a.id}>{i > 0 && ' & '}<button onClick={() => { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }} className="hover:underline">{a.name}</button></span>
                )) : 'Select a song below'}
              </p>
            </div>

            {currentTrack && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #ff2d78, #ff6bb0)', borderRadius: 99, transition: 'width 0.5s linear' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{formatDuration(progressMs)}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{formatDuration(durationMs)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 20 }}>
              <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
              </button>
              <button onClick={togglePlay} className="active:scale-95" style={{ width: 66, height: 66, borderRadius: '50%', background: 'linear-gradient(135deg, #ff2d78, #b0207a)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 22px rgba(255,45,120,0.45)' }}>
                {isPlaying
                  ? <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
              </button>
              <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
              </button>
            </div>

            {/* Search with live dropdown */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '20px 20px 0 0' : 24, border: '1px solid rgba(255,255,255,0.09)' }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: searchLoading ? '#ff6bb0' : 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={inlineQuery}
                  onChange={e => { setInlineQuery(e.target.value); inlineQueryRef.current = e.target.value }}
                  onFocus={() => {
                    setOnKeyPress((key) => {
                      const q = inlineQueryRef.current
                      if (key === 'BACKSPACE') { const next = q.slice(0, -1); inlineQueryRef.current = next; setInlineQuery(next) }
                      else if (key === 'CLEAR') { inlineQueryRef.current = ''; setInlineQuery(''); setInlineDropdown([]); setSearchError('') }
                      else { const next = q + key; inlineQueryRef.current = next; setInlineQuery(next) }
                    })
                    setKeyboardVisible(true)
                  }}
                  placeholder="Search for songs, artists, albums…"
                  inputMode="none"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 14, color: '#fff', caretColor: '#ff6bb0' }}
                />
                {inlineQuery && <button onClick={() => { setInlineQuery(''); setInlineDropdown([]); setSearchError('') }} style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>}
              </div>

              {(searchLoading || searchError) && inlineDropdown.length === 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#161018', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, color: searchError ? '#ff8a8a' : 'rgba(255,255,255,0.4)' }}>{searchLoading ? 'Searching…' : searchError}</p>
                </div>
              )}

              {inlineDropdown.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#161018', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                  {inlineDropdown.map((entry, i) => {
                    const isTrack = entry.type === 'track'
                    const isArtist = entry.type === 'artist'
                    const item = entry.item as SpotifyTrack & SpotifyArtist & SpotifyAlbum
                    const thumb = isArtist ? item.images?.[0]?.url : isTrack ? item.album?.images?.[item.album.images.length - 1]?.url : item.images?.[0]?.url
                    const sub = isTrack ? item.artists?.map((a: { name: string }) => a.name).join(', ') : isArtist ? 'Artist' : 'Album'
                    return (
                      <button key={i} onClick={() => handleInlineSelect(entry)} className="hover:bg-[rgba(255,45,120,0.14)] active:scale-[0.98] transition-all duration-150"
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%', textAlign: 'left', background: 'rgba(255,45,120,0.05)', borderBottom: i < inlineDropdown.length - 1 ? '1px solid rgba(255,45,120,0.16)' : 'none' }}>
                        <div style={{ width: 48, height: 48, borderRadius: isArtist ? '50%' : 8, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.35)', boxShadow: '0 0 10px rgba(255,45,120,0.2)' }}>
                          {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          <p style={{ fontSize: 13, color: '#ff8fc4', marginTop: 2 }}>{sub}{isTrack ? ' · tap to queue' : ' · tap to browse'}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#ff8fc4', fontFamily: 'monospace', textTransform: 'uppercase', flexShrink: 0, padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,45,120,0.35)' }}>{entry.type}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Decades panel */}
          <div style={{ ...glassPanel('rgba(78,224,255,0.65)'), padding: '20px 18px' }}>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: '#4ee0ff', marginBottom: 14 }}>DECADES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DECADES.map((dec) => {
                const isLoading = loadingDecade === dec
                return (
                  <button key={dec} onClick={() => handleDecadePlay(dec)} disabled={!!loadingDecade}
                    className="active:scale-[0.97] transition-transform"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '15px 12px',
                      borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #00d4ff, #4ee0ff)',
                      boxShadow: '0 0 16px rgba(78,224,255,0.5)',
                      opacity: loadingDecade && !isLoading ? 0.35 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                    {isLoading
                      ? <span className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                      : <span style={{ fontSize: 15, fontWeight: 700, color: '#08262e' }}>'{dec}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Most Popular + Recently Played */}
        <div style={{ width: '100%', padding: '0 16px 24px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{
            borderRadius: 22, padding: 2,
            background: 'linear-gradient(to right, #ff2d78, #b450dc, #4ee0ff)',
            boxShadow: '-10px 0 55px rgba(255,45,120,0.4), 10px 0 55px rgba(78,224,255,0.4), 0 0 30px rgba(255,255,255,0.08)',
          }}>
          <div style={{ borderRadius: 20, background: 'linear-gradient(180deg, rgba(20,15,20,0.97), rgba(10,8,12,0.99))', padding: 24 }}>

            {mostPopular.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ffb454', marginBottom: 14, textAlign: 'center' }}>Most Popular</p>
                <div style={{ display: 'flex', gap: 14, overflow: 'hidden' }}>
                  {mostPopular.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 12, overflow: 'hidden', marginBottom: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {popularArtists.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ee0ff', marginBottom: 14, textAlign: 'center' }}>Popular Artists</p>
                <div style={{ display: 'flex', gap: 18, overflow: 'hidden' }}>
                  {popularArtists.map(artist => (
                    <button key={artist.id} onClick={() => { setActiveArtist({ id: artist.id, name: artist.name, imageUrl: artist.images?.[0]?.url }); setActiveView('artist') }}
                      style={{ flexShrink: 0, width: 100, textAlign: 'center' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', marginBottom: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,45,120,0.35)', boxShadow: '0 0 14px rgba(255,45,120,0.2)' }}>
                        {artist.images?.[0]?.url
                          ? <img src={artist.images[0].url} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, color: '#fff' }}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" /></svg>
                            </div>}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {playHistory.length > 0 && (
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', marginBottom: 14, textAlign: 'center' }}>Recently Played</p>
                <div className="scrollbar-none" style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
                  {playHistory.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 12, overflow: 'hidden', marginBottom: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mostPopular.length === 0 && popularArtists.length === 0 && playHistory.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.35)', padding: '20px 0' }}>
                Play a few songs and they'll show up here.
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
