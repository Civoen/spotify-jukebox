'use client'

import { useEffect, useState, useRef } from 'react'
import { useJukeboxStore } from '@/lib/store'
import {
  clearToken, formatDuration, searchDecadeSongs,
  previousTrack as prevTrackApi, findOrCreateJukeboxPlaylist, addTrackToJukeboxPlaylist,
  playTrack, getAlbumArt,
} from '@/lib/spotify'
import { DECADE_SONGS } from '@/lib/decade-tracks'
import { GENRES } from '@/lib/genres'
import { globalPlayer } from './SpotifyPlayer'
import { ArchCrown, chrome } from './ArchCrown'

const MODERN_GENRES = GENRES.filter(g =>
  ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Dance', 'Electronic', 'Jazz', 'Metal'].includes(g.label)
)
const DECADES = ['60s', '70s', '80s', '90s', '00s'] as const

/* ─── Switch design icon — two curved arrows, sits where Insert Coin used to be ─── */
function SwitchDesignIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 8a7 7 0 0 1 12-4.5M18 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14a7 7 0 0 1-12 4.5M4 18v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ModernHomeView() {
  const {
    accessToken, deviceId, setActiveView, setActiveArtist,
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs, skipNext, addToQueue,
    playHistory, addToHistory, incrementPopularity, popularity,
    setKeyboardVisible, setOnKeyPress, setSearchQuery, setUiTheme,
  } = useJukeboxStore()

  const [loadingDecade, setLoadingDecade] = useState<string | null>(null)
  const [inlineQuery, setInlineQuery] = useState('')
  const inlineQueryRef = useRef('')
  const jukeboxPlaylistId = useRef<string | null>(null)

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

  const handleGenreClick = (label: string) => {
    setSearchQuery(label)
    setActiveView('search')
  }

  const handleSearchSubmit = () => {
    if (!inlineQuery.trim()) return
    setSearchQuery(inlineQuery)
    setActiveView('search')
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
    .slice(0, 8)
    .map(p => p.track)

  // Side border strips — same radii as the arch rings, running straight down
  // the full remaining height so the arch visually continues to the bottom.
  const strips = [
    { r: 500, w: 10, bg: chrome, opacity: 0.75, glow: undefined as string | undefined },
    { r: 490, w: 6, bg: '#050200', opacity: 1 },
    { r: 484, w: 6, bg: '#ff2d78', opacity: 0.6, glow: '10px 2px #ff2d7855' },
    { r: 478, w: 6, bg: '#050200', opacity: 1 },
    { r: 472, w: 6, bg: '#00d4ff', opacity: 0.6, glow: '10px 2px #00d4ff55' },
    { r: 466, w: 6, bg: '#050200', opacity: 1 },
    { r: 460, w: 6, bg: chrome, opacity: 0.65 },
    { r: 454, w: 6, bg: '#050200', opacity: 1 },
    { r: 448, w: 6, bg: '#c9a227', opacity: 0.45 },
    { r: 442, w: 2, bg: '#050200', opacity: 1 },
  ]

  const pad = 'max(16px, calc(50% - 512px))'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--retro-cream)' }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `20px ${pad}` }}>
        <button
          onClick={() => setUiTheme('retro')}
          aria-label="Switch to Standard design"
          style={{ color: 'rgba(201,162,39,0.7)', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <SwitchDesignIcon />
        </button>
        <span className="font-typewriter" style={{ fontSize: 13, letterSpacing: '0.1em', color: 'rgba(201,162,39,0.5)', textTransform: 'uppercase' }}>Outside Inn Jukebox</span>
        <button onClick={() => { clearToken(); window.location.reload() }} style={{ color: 'rgba(201,162,39,0.45)', padding: 8 }}>
          <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Arch + vinyl ── */}
      <div style={{ flexShrink: 0, marginTop: -20 }}>
        <ArchCrown albumArt={albumArt} isPlaying={isPlaying} vinylSize={880} topPad={80} vinylScale={0.85} />
      </div>

      {/* ── Everything below the arch: bordered by the arch's rings continuing straight down ── */}
      <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ position: 'relative' }}>
        {strips.map((s, i) => (
          <div key={`l${i}`} style={{ position: 'absolute', top: 0, left: `calc(50% - ${s.r}px)`, bottom: 0, width: s.w, background: s.bg, opacity: s.opacity, zIndex: 10, pointerEvents: 'none', boxShadow: s.glow ? `2px 0 ${s.glow}` : undefined }} />
        ))}
        {strips.map((s, i) => (
          <div key={`r${i}`} style={{ position: 'absolute', top: 0, right: `calc(50% - ${s.r}px)`, bottom: 0, width: s.w, background: s.bg, opacity: s.opacity, zIndex: 10, pointerEvents: 'none', boxShadow: s.glow ? `-2px 0 ${s.glow}` : undefined }} />
        ))}

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_260px] gap-4 max-w-[1000px] mx-auto" style={{ padding: `18px ${pad} 24px` }}>

          {/* Genres panel */}
          <div className="order-2 md:order-1" style={{ borderRadius: 18, border: '2px solid #ff2d78', background: 'rgba(10,5,0,0.97)', boxShadow: '0 0 14px rgba(255,45,120,0.25)', padding: '20px 0' }}>
            <p className="font-retro" style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: '#ff2d78', marginBottom: 14 }}>GENRES</p>
            {MODERN_GENRES.map((g, i) => (
              <button key={g.label} onClick={() => handleGenreClick(g.label)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 22px', borderTop: i > 0 ? '1px solid rgba(255,45,120,0.14)' : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #ff2d78' }} />
                  <span style={{ fontSize: 15, color: '#f5d5e6' }}>{g.label}</span>
                </span>
                <span style={{ color: '#ff2d78' }}>›</span>
              </button>
            ))}
          </div>

          {/* Now Playing panel */}
          <div className="order-1 md:order-2" style={{ borderRadius: 18, border: '2px solid #2a2a35', background: 'rgba(10,5,0,0.97)', padding: '20px 24px' }}>
            <p className="font-typewriter" style={{ textAlign: 'center', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--retro-muted)', marginBottom: 16 }}>Now Playing</p>

            <div style={{ width: 190, height: 190, margin: '0 auto 16px', borderRadius: 10, overflow: 'hidden', background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)' }}>
              {albumArt
                ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: 'var(--retro-gold)' }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>}
            </div>

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <h2 className="font-retro" style={{ fontSize: 22, fontWeight: 700, color: 'var(--retro-cream)' }}>{currentTrack?.name ?? 'No track playing'}</h2>
              <p className="font-typewriter" style={{ fontSize: 14, color: 'var(--retro-gold)', marginTop: 4 }}>
                {currentTrack ? currentTrack.artists.map((a, i) => (
                  <span key={a.id}>{i > 0 && ' & '}<button onClick={() => { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }} className="hover:underline">{a.name}</button></span>
                )) : 'Select a song below'}
              </p>
            </div>

            {currentTrack && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ height: 5, background: 'rgba(201,162,39,0.12)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: '#ff2d78', borderRadius: 99, transition: 'width 0.5s linear' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="font-typewriter" style={{ fontSize: 12, color: 'var(--retro-muted)' }}>{formatDuration(progressMs)}</span>
                  <span className="font-typewriter" style={{ fontSize: 12, color: 'var(--retro-muted)' }}>{formatDuration(durationMs)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 20 }}>
              <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.35)', color: 'var(--retro-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
              </button>
              <button onClick={togglePlay} className="active:scale-95" style={{ width: 66, height: 66, borderRadius: '50%', background: '#ff2d78', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(255,45,120,0.5)' }}>
                {isPlaying
                  ? <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
              </button>
              <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.35)', color: 'var(--retro-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 48, background: 'rgba(20,20,32,0.8)', borderRadius: 24, border: '1px solid rgba(201,162,39,0.18)' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: 'rgba(201,162,39,0.55)', flexShrink: 0 }}>
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
                    else if (key === 'CLEAR') { inlineQueryRef.current = ''; setInlineQuery('') }
                    else if (key === 'ENTER') { handleSearchSubmit() }
                    else { const next = q + key; inlineQueryRef.current = next; setInlineQuery(next) }
                  })
                  setKeyboardVisible(true)
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit() }}
                placeholder="Search for songs, artists, albums…"
                inputMode="none"
                className="flex-1 bg-transparent outline-none font-typewriter"
                style={{ fontSize: 14, color: 'var(--retro-cream)', caretColor: 'var(--retro-gold)' }}
              />
              <button onClick={handleSearchSubmit} style={{ color: 'rgba(0,212,255,0.8)' }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>

          {/* Decades panel */}
          <div className="order-3" style={{ borderRadius: 18, border: '2px solid #00d4ff', background: 'rgba(10,5,0,0.97)', boxShadow: '0 0 14px rgba(0,212,255,0.25)', padding: '20px 0' }}>
            <p className="font-retro" style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: '#00d4ff', marginBottom: 14 }}>DECADES</p>
            {DECADES.map((dec, i) => {
              const isLoading = loadingDecade === dec
              return (
                <button key={dec} onClick={() => handleDecadePlay(dec)} disabled={!!loadingDecade}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 22px', borderTop: i > 0 ? '1px solid rgba(0,212,255,0.14)' : 'none', opacity: loadingDecade && !isLoading ? 0.4 : 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isLoading && <span className="skeleton" style={{ width: 12, height: 12, borderRadius: '50%' }} />}
                    </span>
                    <span style={{ fontSize: 15, color: '#cdeeff' }}>'{dec}</span>
                  </span>
                  <span style={{ color: '#00d4ff' }}>›</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Most Popular + Recently Played */}
        <div style={{ padding: `0 ${pad} 24px`, maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ borderRadius: 18, border: '2px solid #c9a227', background: 'rgba(10,5,0,0.97)', boxShadow: '0 0 12px rgba(201,162,39,0.2)', padding: 24 }}>

            {mostPopular.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p className="font-typewriter" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffb454', marginBottom: 14 }}>Most Popular</p>
                <div className="scrollbar-none" style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
                  {mostPopular.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.18)' }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--retro-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {playHistory.length > 0 && (
              <div>
                <p className="font-typewriter" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--retro-cream)', marginBottom: 14 }}>Recently Played</p>
                <div className="scrollbar-none" style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
                  {playHistory.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.18)' }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--retro-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mostPopular.length === 0 && playHistory.length === 0 && (
              <p className="font-typewriter" style={{ textAlign: 'center', fontSize: 14, color: 'var(--retro-muted)', padding: '20px 0' }}>
                Play a few songs and they'll show up here.
              </p>
            )}
          </div>
        </div>
        </div>{/* end relative strips wrapper */}
      </div>
    </div>
  )
}
