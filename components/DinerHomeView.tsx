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

const RED = '#c0302b'
const RED_LIGHT = '#e0554f'
const TEAL = '#1a8a93'
const TEAL_LIGHT = '#4bb8c0'
const CREAM = '#f5e8cc'
const CHROME = '#d9d4c8'
const BLACK_PANEL = '#0e0c0a'

const FRAME_MAX = 1000
const BANDS = [
  { color: RED, r: 480 },
  { color: CREAM, r: 462 },
  { color: TEAL, r: 444 },
  { color: CHROME, r: 428 },
]
const CONTENT_R = 412
const DOME_RATIO = 0.5

function Starburst({ size, color, points = 8 }: { size: number; color: string; points?: number }) {
  const pts: string[] = []
  const c = size / 2
  const n = points * 2
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2
    const r = i % 2 === 0 ? c : c * 0.42
    pts.push(`${c + r * Math.cos(ang)},${c + r * Math.sin(ang)}`)
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts.join(' ')} fill={color} />
    </svg>
  )
}

// Fluted column — short stack of horizontal chrome ridges, sitting where the
// dome meets the straight sides
function FlutedColumn() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ width: 38, height: 11, borderRadius: 6, background: CREAM, border: '2px solid rgba(10,8,6,0.85)' }} />
      ))}
    </div>
  )
}

// Compass-rose medallion for the bottom corners
function CompassMedallion({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
      background: BLACK_PANEL, border: `4px solid ${CREAM}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Starburst size={size * 0.66} color={CREAM} />
      <div style={{ position: 'absolute', width: size * 0.14, height: size * 0.14, borderRadius: '50%', background: RED, border: `2px solid ${CREAM}` }} />
    </div>
  )
}

// Pill-shaped list button
function PillButton({ label, onClick, disabled, loading }: {
  label: string; onClick: () => void; disabled?: boolean; loading?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="active:scale-[0.97] transition-transform"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 16px',
        borderRadius: 999, border: 'none', background: CREAM,
        opacity: disabled && !loading ? 0.4 : 1, transition: 'opacity 0.2s',
      }}>
      {loading
        ? <span className="skeleton" style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} />
        : <span style={{ width: 12, height: 12, borderRadius: '50%', background: RED, flexShrink: 0, border: '2px solid rgba(10,8,6,0.5)' }} />}
      <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1210' }}>{label}</span>
    </button>
  )
}

function SectionDivider({ label, color }: { label: string; color: string }) {
  const lines = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: 2, background: `${color}` }} />
      <div style={{ height: 2, background: `${color}88` }} />
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      {lines}
      <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', color: TEAL, whiteSpace: 'nowrap' }}>{label}</p>
      {lines}
    </div>
  )
}

// Arch frame — dome with a sunburst peak badge, chrome/red/cream/teal bands,
// fluted columns at the springing point, continuing as straight sides
function DinerFrame({ children }: { children: React.ReactNode }) {
  const archTopPad = 30
  const maxVR = BANDS[0].r * DOME_RATIO
  const archH = archTopPad + maxVR
  const cx = FRAME_MAX / 2

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: FRAME_MAX, margin: '0 auto' }}>
      {/* Peak badge */}
      <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <div style={{
          width: 90, height: 64, background: `linear-gradient(180deg, ${RED_LIGHT}, ${RED})`,
          border: `3px solid ${CREAM}`, borderRadius: '6px',
          clipPath: 'polygon(14% 0%, 86% 0%, 100% 100%, 0% 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Starburst size={34} color="white" />
        </div>
      </div>

      {/* Domed top */}
      <div style={{ position: 'relative', height: archH, overflow: 'hidden' }}>
        {BANDS.map((b, i) => {
          const vr = b.r * DOME_RATIO
          return (
            <div key={i} style={{
              position: 'absolute', width: b.r * 2, height: vr * 2, borderRadius: '50%',
              top: archTopPad + maxVR - vr, left: cx - b.r, background: b.color,
            }} />
          )
        })}
        <div style={{
          position: 'absolute', width: CONTENT_R * 2, height: CONTENT_R * DOME_RATIO * 2, borderRadius: '50%',
          top: archTopPad + maxVR - CONTENT_R * DOME_RATIO, left: cx - CONTENT_R, background: CREAM,
        }} />

        {/* Title inside the dome */}
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', padding: '0 70px' }}>
          <p style={{ fontSize: 15, letterSpacing: '0.3em', color: TEAL, fontWeight: 700 }}>WELCOME TO</p>
          <h1 className="font-retro" style={{ fontSize: 40, fontStyle: 'italic', fontWeight: 700, color: RED, lineHeight: 1.1 }}>The Outside Inn</h1>
          <p style={{ fontSize: 22, letterSpacing: '0.3em', color: TEAL, fontWeight: 800, marginTop: 2 }}>JUKEBOX</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, justifyContent: 'center' }}>
            <div style={{ width: 90, height: 2, background: RED }} />
            <div style={{ width: 90, height: 2, background: RED }} />
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 56, left: cx - 240 }}><Starburst size={14} color={RED} /></div>
        <div style={{ position: 'absolute', bottom: 56, right: cx - 240 }}><Starburst size={14} color={RED} /></div>
      </div>

      {/* Fluted columns at the springing point */}
      <div style={{ position: 'absolute', top: archH - 26, left: cx - BANDS[0].r - 30, zIndex: 4 }}><FlutedColumn /></div>
      <div style={{ position: 'absolute', top: archH - 26, right: cx - BANDS[0].r - 30, zIndex: 4 }}><FlutedColumn /></div>

      {/* Straight sides */}
      <div style={{ position: 'relative' }}>
        {BANDS.map((b, i) => {
          const inner = i < BANDS.length - 1 ? BANDS[i + 1].r : CONTENT_R
          return <div key={`l${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: cx - b.r, width: b.r - inner, background: b.color }} />
        })}
        {BANDS.map((b, i) => {
          const inner = i < BANDS.length - 1 ? BANDS[i + 1].r : CONTENT_R
          return <div key={`r${i}`} style={{ position: 'absolute', top: 0, bottom: 0, right: cx - b.r, width: b.r - inner, background: b.color }} />
        })}
        <div style={{ position: 'relative', margin: `0 ${FRAME_MAX / 2 - CONTENT_R}px`, background: BLACK_PANEL, minHeight: 40 }}>
          {children}
        </div>
      </div>

      {/* Compass medallions flanking the bottom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 10px 0' }}>
        <CompassMedallion size={80} />
        <CompassMedallion size={80} />
      </div>
    </div>
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
      setInlineDropdown([]); setSearchError(''); setSearchLoading(false)
      return
    }
    setSearchLoading(true); setSearchError('')
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
    setInlineQuery(''); inlineQueryRef.current = ''; setInlineDropdown([])
    if (entry.type === 'artist') {
      const a = entry.item as SpotifyArtist
      setActiveArtist({ id: a.id, name: a.name, imageUrl: a.images?.[0]?.url })
      setActiveView('artist')
    } else if (entry.type === 'album') {
      setActiveAlbum(entry.item as SpotifyAlbum)
      setActiveView('album')
    } else {
      const t = entry.item as SpotifyTrack
      if (!currentTrack && accessToken && deviceId) playTrack(accessToken, t.uri, deviceId)
      else addToQueue(t)
    }
  }

  const shufflePlay = async (tracks: SpotifyTrack[]) => {
    if (!tracks.length || !accessToken) return
    const shuffled = [...tracks]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const { currentTrack: ct, deviceId: did, setContextQueue } = useJukeboxStore.getState()
    if (ct) setContextQueue(shuffled)
    else if (did) { setContextQueue(shuffled.slice(1)); playTrack(accessToken, shuffled[0].uri, did) }
    else setContextQueue(shuffled)
  }

  const handleDecadePlay = async (decade: string) => {
    if (!accessToken || loadingDecade) return
    setLoadingDecade(decade)
    try {
      const tracks = await searchDecadeSongs(DECADE_SONGS[decade] ?? [], accessToken, decade)
      await shufflePlay(tracks)
    } catch (e) { console.error(e) } finally { setLoadingDecade(null) }
  }

  const handleGenreClick = async (label: string) => {
    if (!accessToken || loadingGenre) return
    setLoadingGenre(label)
    try {
      const tracks = await searchGenreSongs(label, accessToken)
      await shufflePlay(tracks)
    } catch (e) { console.error(e) } finally { setLoadingGenre(null) }
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
    if (accessToken) prevTrackApi(accessToken, deviceId ?? undefined).catch(() => globalPlayer?.previousTrack())
    else globalPlayer?.previousTrack()
  }

  const progress = durationMs > 0 ? (progressMs / durationMs) * 100 : 0
  const albumArt = currentTrack?.album.images?.[0]?.url

  const mostPopular = Object.values(popularity).sort((a, b) => b.count - a.count).slice(0, 5).map(p => p.track)

  const topArtistIds = useMemo(() => {
    const counts: Record<string, { id: string; name: string; count: number }> = {}
    for (const { track, count } of Object.values(popularity)) {
      const artist = track.artists[0]
      if (!artist) continue
      if (!counts[artist.id]) counts[artist.id] = { id: artist.id, name: artist.name, count: 0 }
      counts[artist.id].count += count
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5).map(a => a.id)
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
    <div className="h-full flex flex-col overflow-hidden" style={{ color: CREAM, background: '#08090a' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', maxWidth: FRAME_MAX, margin: '0 auto', padding: '16px 16px 4px' }}>
        <div style={{ justifySelf: 'start' }}>
          <ThemeSwitcher color="rgba(245,232,204,0.55)" menuBg="#1c1006" accentColor={RED_LIGHT} border={`1px solid ${RED}55`} />
        </div>
        <div />
        <button onClick={() => { clearToken(); window.location.reload() }} style={{ justifySelf: 'end', color: 'rgba(245,232,204,0.4)', padding: 8 }}>
          <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
        <DinerFrame>

          {/* Turntable box */}
          <div style={{ margin: '20px 16px 16px', borderRadius: 14, background: '#050403', border: `3px solid ${CREAM}`, boxShadow: `0 0 0 2px ${CHROME}`, padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ width: 68 - i * 2, height: 5, borderRadius: 2, background: `rgba(245,232,204,${0.15 + i * 0.03})`, marginLeft: i }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={140} tilt />
            </div>
            <div style={{ flexShrink: 0, borderRadius: 10, border: `2px solid ${RED}`, background: CREAM, padding: '8px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: RED, lineHeight: 1 }}>45</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#241a08', letterSpacing: '0.05em' }}>RPM</p>
            </div>
          </div>

          {/* Genres | Now Playing | Decades */}
          <div className="grid grid-cols-[220px_1fr_220px] gap-3" style={{ margin: '0 16px 16px' }}>

            <div style={{ borderRadius: 14, background: '#050403', border: `3px solid ${CREAM}`, boxShadow: `0 0 0 2px ${TEAL}88`, padding: '14px' }}>
              <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: TEAL, marginBottom: 10 }}>GENRES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {DINER_GENRES.map((g) => (
                  <PillButton key={g.label} label={g.label} onClick={() => handleGenreClick(g.label)} disabled={!!loadingGenre} loading={loadingGenre === g.label} />
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 14, background: '#050403', border: `3px solid ${CREAM}`, boxShadow: `0 0 0 2px ${TEAL}88`, padding: '16px' }}>
              <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: TEAL, marginBottom: 10 }}>♪ NOW PLAYING ♪</p>
              <div onClick={() => setFullscreenOpen(true)} style={{ borderRadius: 10, background: '#000', border: `2px solid ${TEAL}55`, padding: '18px 14px', textAlign: 'center', marginBottom: 14, cursor: 'pointer', minHeight: 90 }}>
                <h2 className="font-retro" style={{ fontSize: 18, fontStyle: 'italic', fontWeight: 700, color: TEAL_LIGHT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{currentTrack?.name ?? 'No track playing'}</h2>
                <p style={{ fontSize: 13, color: TEAL_LIGHT, opacity: 0.75, marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {currentTrack ? currentTrack.artists.map(a => a.name).join(', ') : 'Select a song below'}
                </p>
              </div>
              {currentTrack && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ height: 5, background: 'rgba(245,232,204,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: RED, borderRadius: 99, transition: 'width 0.5s linear' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'rgba(245,232,204,0.45)' }}>{formatDuration(progressMs)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(245,232,204,0.45)' }}>{formatDuration(durationMs)}</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(180deg, ${TEAL_LIGHT}, ${TEAL})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${CREAM}` }}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" /></svg>
                </button>
                <button onClick={togglePlay} className="active:scale-95" style={{ width: 62, height: 62, borderRadius: '50%', background: `linear-gradient(180deg, ${RED_LIGHT}, ${RED})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${CREAM}`, boxShadow: `0 0 16px ${RED}88` }}>
                  {isPlaying
                    ? <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                    : <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
                </button>
                <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(180deg, ${TEAL_LIGHT}, ${TEAL})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${CREAM}` }}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 46, background: CREAM, borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '18px 18px 0 0' : 23 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: searchLoading ? RED : '#4a4038', flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text" value={inlineQuery}
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
                    style={{ fontSize: 13, color: '#1a1210' }}
                  />
                </div>
                {(searchLoading || searchError) && inlineDropdown.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c1006', border: `2px solid ${TEAL}44`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '10px 14px' }}>
                    <p style={{ fontSize: 12, color: searchError ? '#ff8a8a' : 'rgba(245,232,204,0.4)' }}>{searchLoading ? 'Searching…' : searchError}</p>
                  </div>
                )}
                {inlineDropdown.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c1006', border: `2px solid ${TEAL}44`, borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                    {inlineDropdown.map((entry, i) => {
                      const isTrack = entry.type === 'track'
                      const isArtist = entry.type === 'artist'
                      const item = entry.item as SpotifyTrack & SpotifyArtist & SpotifyAlbum
                      const thumb = isArtist ? item.images?.[0]?.url : isTrack ? item.album?.images?.[item.album.images.length - 1]?.url : item.images?.[0]?.url
                      const sub = isTrack ? item.artists?.map((a: { name: string }) => a.name).join(', ') : isArtist ? 'Artist' : 'Album'
                      return (
                        <button key={i} onClick={() => handleInlineSelect(entry)} className="hover:bg-[rgba(26,138,147,0.14)] active:scale-[0.98] transition-all duration-150"
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', textAlign: 'left', borderBottom: i < inlineDropdown.length - 1 ? `1px solid ${TEAL}33` : 'none' }}>
                          <div style={{ width: 40, height: 40, borderRadius: isArtist ? '50%' : 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(26,138,147,0.1)', border: `1px solid ${TEAL}55` }}>
                            {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                            <p style={{ fontSize: 12, color: TEAL_LIGHT, marginTop: 1 }}>{sub}{isTrack ? ' · tap to queue' : ' · tap to browse'}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderRadius: 14, background: '#050403', border: `3px solid ${CREAM}`, boxShadow: `0 0 0 2px ${TEAL}88`, padding: '14px' }}>
              <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: TEAL, marginBottom: 10 }}>DECADES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {DECADES.map((dec) => (
                  <PillButton key={dec} label={`'${dec}`} onClick={() => handleDecadePlay(dec)} disabled={!!loadingDecade} loading={loadingDecade === dec} />
                ))}
              </div>
            </div>
          </div>

          {/* Most Popular */}
          {mostPopular.length > 0 && (
            <div style={{ margin: '0 16px 16px', borderRadius: 14, background: CREAM, padding: '18px' }}>
              <SectionDivider label="MOST POPULAR" color={RED} />
              <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                {mostPopular.map(track => (
                  <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                    style={{ flexShrink: 0, width: 130, textAlign: 'left' }} className="active:scale-95 transition-transform">
                    <div style={{ width: 130, height: 130, borderRadius: 8, overflow: 'hidden', marginBottom: 6, border: `2px solid ${BLACK_PANEL}` }}>
                      <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1210', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                    <p style={{ fontSize: 11, color: TEAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently Played */}
          {playHistory.length > 0 && (
            <div style={{ margin: '0 16px 16px', borderRadius: 14, background: CREAM, padding: '18px' }}>
              <SectionDivider label="RECENTLY PLAYED" color={RED} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {playHistory.slice(0, 10).map(track => (
                  <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                    style={{ textAlign: 'left' }} className="active:scale-95 transition-transform">
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', marginBottom: 6, border: `2px solid ${BLACK_PANEL}` }}>
                      <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#1a1210', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                    <p style={{ fontSize: 10, color: TEAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Artists */}
          {popularArtists.length > 0 && (
            <div style={{ margin: '0 16px 20px', borderRadius: 14, background: CREAM, padding: '18px' }}>
              <SectionDivider label="POPULAR ARTISTS" color={RED} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {popularArtists.map(artist => (
                  <div key={artist.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(10,8,6,0.06)', borderRadius: 999, padding: '8px 10px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: BLACK_PANEL, border: `2px solid ${TEAL}` }}>
                      {artist.images?.[0]?.url
                        ? <img src={artist.images[0].url} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: TEAL }}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" /></svg>
                          </div>}
                    </div>
                    <p style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#1a1210', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</p>
                    <button onClick={() => { setActiveArtist({ id: artist.id, name: artist.name, imageUrl: artist.images?.[0]?.url }); setActiveView('artist') }}
                      style={{ flexShrink: 0, background: TEAL, color: 'white', fontWeight: 800, fontSize: 13, padding: '8px 20px', borderRadius: 999 }}>
                      VIEW
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mostPopular.length === 0 && playHistory.length === 0 && popularArtists.length === 0 && (
            <div style={{ margin: '0 16px 20px', borderRadius: 14, background: CREAM, padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#6a5a48' }}>Play a few songs and they&apos;ll show up here.</p>
            </div>
          )}

        </DinerFrame>
      </div>
    </div>
  )
}
