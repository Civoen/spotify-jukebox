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
import ThemeSwitcher from './ThemeSwitcher'
import SpinningVinyl from './SpinningVinyl'

const DINER_GENRES = GENRES.filter(g =>
  ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Dance', 'Electronic', 'Metal'].includes(g.label)
)
const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'] as const

const RED = '#c9302c'
const RED_LIGHT = '#ff6b5a'
const TEAL = '#2a8a8a'
const TEAL_LIGHT = '#5cd6d6'
const CREAM = '#f0e4c8'
const CHROME = 'linear-gradient(180deg, #e8dcc0 0%, #c9b888 25%, #f5ecd0 50%, #a89060 75%, #dcc898 100%)'

// Solid chrome-plated card — opaque diner "enamel plate" look, not a glow panel
function dinerCard(borderColor: string) {
  return {
    borderRadius: 16,
    background: 'linear-gradient(180deg, #241208 0%, #180a04 100%)',
    border: `2px solid ${borderColor}`,
    boxShadow: `0 6px 0 rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
  } as React.CSSProperties
}

// Warm bulb dot, positioned along a ring's arc — the diner equivalent of Modern's neon glow
function Bulb({ x, y }: { x: number; y: number }) {
  return (
    <div style={{
      position: 'absolute', left: x - 6, top: y - 6, width: 12, height: 12, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fff8e0, #ffce6b 60%, #e8a020 100%)',
      boxShadow: '0 0 10px 3px rgba(255,206,107,0.7), 0 0 3px rgba(255,255,255,0.9)',
    }} />
  )
}

// Diner arch — chrome/red/teal rings with warm bulbs instead of Modern's waveform hero
function DinerArch({ albumArt, isPlaying }: { albumArt?: string; isPlaying: boolean }) {
  const size = 620
  const vR = size / 2
  const rings = [
    { gap: 56, bg: CHROME, bulbs: false },
    { gap: 42, bg: RED, bulbs: true },
    { gap: 28, bg: TEAL, bulbs: true },
    { gap: 14, bg: CHROME, bulbs: false },
  ]
  return (
    <div style={{ position: 'relative', width: '100%', height: size + 60, flexShrink: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: size + 120, height: size + 60 }}>
        {rings.map((r, i) => {
          const d = (vR + r.gap) * 2
          const cx = (size + 120) / 2
          const cy = size / 2 + 10
          const bulbs = []
          if (r.bulbs) {
            const radius = vR + r.gap
            for (let a = 200; a <= 340; a += 11) {
              const rad = (a * Math.PI) / 180
              bulbs.push(<Bulb key={a} x={cx + radius * Math.cos(rad)} y={cy + radius * Math.sin(rad)} />)
            }
          }
          return (
            <div key={i}>
              <div style={{
                position: 'absolute', width: d, height: d, borderRadius: '50%',
                top: cy - (vR + r.gap), left: cx - (vR + r.gap),
                background: r.bg, opacity: r.bulbs ? 0.9 : 1,
              }} />
              {bulbs}
            </div>
          )
        })}
        {/* Vinyl */}
        <div style={{ position: 'absolute', top: size / 2 + 10 - vR + 20, left: (size + 120) / 2 - vR + 20, zIndex: 2 }}>
          <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={size - 40} />
        </div>
      </div>
    </div>
  )
}

// Glossy filled button — same technique as Modern's genre/decade buttons, red or teal
function DinerButton({ label, color, colorLight, colorDark, textColor, onClick, disabled, loading }: {
  label: string; color: string; colorLight: string; colorDark: string; textColor: string
  onClick: () => void; disabled?: boolean; loading?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="active:scale-[0.97] transition-transform"
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '15px 10px',
        borderRadius: 14, border: 'none', overflow: 'hidden',
        background: `linear-gradient(180deg, ${colorLight} 0%, ${color} 45%, ${colorDark} 100%)`,
        boxShadow: `0 0 14px ${color}88, inset 0 -2px 4px rgba(0,0,0,0.25)`,
        opacity: disabled && !loading ? 0.35 : 1,
        transition: 'opacity 0.2s',
      }}>
      <span style={{ position: 'absolute', top: 2, left: 2, right: 2, height: '42%', borderRadius: '12px 12px 50% 50% / 12px 12px 100% 100%', background: 'rgba(255,255,255,0.4)', filter: 'blur(2px)', pointerEvents: 'none' }} />
      {loading
        ? <span className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%', position: 'relative' }} />
        : <span style={{ fontSize: 17, fontWeight: 800, color: textColor, position: 'relative' }}>{label}</span>}
    </button>
  )
}

export default function DinerHomeView() {
  const {
    accessToken, deviceId, setActiveView, setActiveArtist, setActiveAlbum,
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs, skipNext, addToQueue,
    playHistory, addToHistory, incrementPopularity, popularity,
    setKeyboardVisible, setOnKeyPress, setFullscreenOpen,
  } = useJukeboxStore()

  const [loadingDecade, setLoadingDecade] = useState<string | null>(null)
  const [loadingGenre, setLoadingGenre] = useState<string | null>(null)
  const [inlineQuery, setInlineQuery] = useState('')
  const inlineQueryRef = useRef('')
  const jukeboxPlaylistId = useRef<string | null>(null)

  const [inlineDropdown, setInlineDropdown] = useState<{ type: 'track' | 'artist' | 'album'; item: SpotifyTrack | SpotifyArtist | SpotifyAlbum }[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const inlineDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const topArtistIds = useMemo(() => {
    const counts: Record<string, { id: string; name: string; count: number }> = {}
    for (const { track, count } of Object.values(popularity)) {
      const artist = track.artists[0]
      if (!artist) continue
      if (!counts[artist.id]) counts[artist.id] = { id: artist.id, name: artist.name, count: 0 }
      counts[artist.id].count += count
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6).map(a => a.id)
  }, [popularity])

  const [popularArtists, setPopularArtists] = useState<SpotifyArtist[]>([])
  useEffect(() => {
    if (!accessToken || topArtistIds.length === 0) { setPopularArtists([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      getArtistsByIds(topArtistIds, accessToken).then((artists) => {
        if (!cancelled) {
          const byId = new Map(artists.map(a => [a.id, a]))
          setPopularArtists(topArtistIds.map(id => byId.get(id)).filter((a): a is SpotifyArtist => !!a))
        }
      }).catch(() => { if (!cancelled) setPopularArtists([]) })
    }, 2500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [topArtistIds.join(','), accessToken])

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: CREAM, background: 'radial-gradient(ellipse at 50% 0%, rgba(120,40,20,0.2) 0%, transparent 55%), #170b06' }}>

      {/* ── Top bar ── */}
      <div style={{ height: 10, background: CHROME, opacity: 0.85, flexShrink: 0 }} />
      <div style={{ display: 'flex', height: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, background: `linear-gradient(90deg, transparent, ${RED}77, transparent)` }} />
        <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #f0e4c877, transparent)' }} />
        <div style={{ flex: 1, background: `linear-gradient(90deg, transparent, ${TEAL}77, transparent)` }} />
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ justifySelf: 'start' }}>
          <ThemeSwitcher color="rgba(240,228,200,0.55)" menuBg="#1c0f06" accentColor={RED_LIGHT} border={`1px solid ${RED}55`} />
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <p style={{ fontSize: 15, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,228,200,0.4)', marginBottom: 6, fontWeight: 500 }}>Welcome To</p>
          <h1 className="font-retro" style={{
            fontSize: 52, fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05, color: RED_LIGHT,
            textShadow: `0 0 14px ${RED}aa, 0 0 40px ${RED}55`,
          }}>
            The Outside Inn
          </h1>
        </div>
        <button onClick={() => { clearToken(); window.location.reload() }} style={{ justifySelf: 'end', color: 'rgba(240,228,200,0.4)', padding: 8 }}>
          <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Chrome arch with warm bulbs + vinyl ── */}
      <DinerArch albumArt={albumArt} isPlaying={isPlaying} />

      <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>

        <div className="grid grid-cols-[260px_1fr_260px] gap-4 max-w-[1000px] mx-auto" style={{ padding: '18px 16px 24px' }}>

          {/* Genres panel */}
          <div style={{ ...dinerCard(RED), padding: '20px 18px' }}>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: RED_LIGHT, marginBottom: 14 }}>GENRES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DINER_GENRES.map((g) => (
                <DinerButton key={g.label} label={g.label} color={RED} colorLight="#ff9a8a" colorDark="#6a1210" textColor="white"
                  onClick={() => handleGenreClick(g.label)} disabled={!!loadingGenre} loading={loadingGenre === g.label} />
              ))}
            </div>
          </div>

          {/* Now Playing panel */}
          <div style={{ ...dinerCard(CREAM), padding: '22px 24px' }}>
            <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,228,200,0.4)', marginBottom: 16, fontWeight: 600 }}>Now Playing</p>

            <div onClick={() => setFullscreenOpen(true)} style={{ width: 190, height: 190, margin: '0 auto 16px', borderRadius: 12, overflow: 'hidden', background: 'rgba(240,228,200,0.05)', border: `2px solid ${CREAM}33`, cursor: 'pointer' }}>
              {albumArt
                ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: CREAM }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>}
            </div>

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <h2 className="font-retro" style={{ fontSize: 21, fontStyle: 'italic', fontWeight: 700, color: CREAM, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{currentTrack?.name ?? 'No track playing'}</h2>
              <p style={{ fontSize: 14, color: RED_LIGHT, marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {currentTrack ? currentTrack.artists.map((a, i) => (
                  <span key={a.id}>{i > 0 && ' & '}<button onClick={() => { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }} className="hover:underline">{a.name}</button></span>
                )) : 'Select a song below'}
              </p>
            </div>

            {currentTrack && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ height: 6, background: 'rgba(240,228,200,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${RED}, ${RED_LIGHT})`, borderRadius: 99, transition: 'width 0.5s linear' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'rgba(240,228,200,0.45)' }}>{formatDuration(progressMs)}</span>
                  <span style={{ fontSize: 12, color: 'rgba(240,228,200,0.45)' }}>{formatDuration(durationMs)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 20 }}>
              <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(180deg, #241a10, #140c06)', border: `2px solid ${CREAM}33`, color: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
              </button>
              <button onClick={togglePlay} className="active:scale-95" style={{ width: 66, height: 66, borderRadius: '50%', background: `linear-gradient(180deg, #ff9a8a, ${RED} 45%, #6a1210 100%)`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 22px ${RED}88` }}>
                {isPlaying
                  ? <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
              </button>
              <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(180deg, #241a10, #140c06)', border: `2px solid ${CREAM}33`, color: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
              </button>
            </div>

            {/* Search with live dropdown */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 48, background: '#100804', borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '20px 20px 0 0' : 24, border: `2px solid ${RED}55` }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: searchLoading ? RED_LIGHT : 'rgba(240,228,200,0.35)', flexShrink: 0 }}>
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
                  style={{ fontSize: 14, color: CREAM, caretColor: RED_LIGHT }}
                />
                {inlineQuery && <button onClick={() => { setInlineQuery(''); setInlineDropdown([]); setSearchError('') }} style={{ color: 'rgba(240,228,200,0.4)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>}
              </div>

              {(searchLoading || searchError) && inlineDropdown.length === 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c0f06', border: `2px solid ${RED}55`, borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, color: searchError ? '#ff8a8a' : 'rgba(240,228,200,0.4)' }}>{searchLoading ? 'Searching…' : searchError}</p>
                </div>
              )}

              {inlineDropdown.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c0f06', border: `2px solid ${RED}55`, borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                  {inlineDropdown.map((entry, i) => {
                    const isTrack = entry.type === 'track'
                    const isArtist = entry.type === 'artist'
                    const item = entry.item as SpotifyTrack & SpotifyArtist & SpotifyAlbum
                    const thumb = isArtist ? item.images?.[0]?.url : isTrack ? item.album?.images?.[item.album.images.length - 1]?.url : item.images?.[0]?.url
                    const sub = isTrack ? item.artists?.map((a: { name: string }) => a.name).join(', ') : isArtist ? 'Artist' : 'Album'
                    return (
                      <button key={i} onClick={() => handleInlineSelect(entry)} className="hover:bg-[rgba(201,48,44,0.14)] active:scale-[0.98] transition-all duration-150"
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%', textAlign: 'left', background: 'rgba(201,48,44,0.06)', borderBottom: i < inlineDropdown.length - 1 ? `1px solid ${RED}33` : 'none' }}>
                        <div style={{ width: 48, height: 48, borderRadius: isArtist ? '50%' : 8, overflow: 'hidden', flexShrink: 0, background: 'rgba(201,48,44,0.1)', border: `1px solid ${RED}55` }}>
                          {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          <p style={{ fontSize: 13, color: RED_LIGHT, marginTop: 2 }}>{sub}{isTrack ? ' · tap to queue' : ' · tap to browse'}</p>
                        </div>
                        <span style={{ fontSize: 11, color: RED_LIGHT, fontFamily: 'monospace', textTransform: 'uppercase', flexShrink: 0, padding: '3px 8px', borderRadius: 20, border: `1px solid ${RED}55` }}>{entry.type}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Decades panel */}
          <div style={{ ...dinerCard(TEAL), padding: '20px 18px' }}>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: TEAL_LIGHT, marginBottom: 14 }}>DECADES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DECADES.map((dec) => (
                <DinerButton key={dec} label={`'${dec}`} color={TEAL} colorLight="#9de8e8" colorDark="#0f3a3a" textColor="white"
                  onClick={() => handleDecadePlay(dec)} disabled={!!loadingDecade} loading={loadingDecade === dec} />
              ))}
            </div>
          </div>
        </div>

        {/* Most Popular + Popular Artists + Recently Played */}
        <div style={{ width: '100%', padding: '0 16px 24px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ ...dinerCard(CREAM), padding: 24 }}>

            {mostPopular.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: RED_LIGHT, marginBottom: 14, textAlign: 'center' }}>Most Popular</p>
                <div style={{ display: 'flex', gap: 14, overflow: 'hidden' }}>
                  {mostPopular.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'rgba(240,228,200,0.04)', border: `1px solid ${RED}44` }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'rgba(240,228,200,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {popularArtists.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEAL_LIGHT, marginBottom: 14, textAlign: 'center' }}>Popular Artists</p>
                <div style={{ display: 'flex', gap: 18, overflow: 'hidden' }}>
                  {popularArtists.map(artist => (
                    <button key={artist.id} onClick={() => { setActiveArtist({ id: artist.id, name: artist.name, imageUrl: artist.images?.[0]?.url }); setActiveView('artist') }}
                      style={{ flexShrink: 0, width: 100, textAlign: 'center' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', marginBottom: 8, background: 'rgba(240,228,200,0.04)', border: `2px solid ${TEAL}66` }}>
                        {artist.images?.[0]?.url
                          ? <img src={artist.images[0].url} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, color: CREAM }}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" /></svg>
                            </div>}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {playHistory.length > 0 && (
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: CREAM, marginBottom: 14, textAlign: 'center' }}>Recently Played</p>
                <div className="scrollbar-none" style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
                  {playHistory.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 128, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 128, height: 128, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'rgba(240,228,200,0.04)', border: `1px solid ${TEAL}44` }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 12, color: 'rgba(240,228,200,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mostPopular.length === 0 && popularArtists.length === 0 && playHistory.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(240,228,200,0.35)', padding: '20px 0' }}>
                Play a few songs and they'll show up here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
