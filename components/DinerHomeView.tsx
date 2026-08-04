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
const CHROME_FLAT = '#c9c0a8'
const CHROME_DARK = '#8a8270'
const BLACK_PANEL = '#0e0800'

const FRAME_MAX = 1000
const BANDS = [
  { color: RED, r: 480 },
  { color: CREAM, r: 464 },
  { color: TEAL, r: 448 },
  { color: CHROME_FLAT, r: 434 },
]
const CONTENT_R = 420

// 8-point starburst, used for the peak badge and the speaker-grille centers
function Starburst({ size, color }: { size: number; color: string }) {
  const pts: string[] = []
  const c = size / 2
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI * 2 * i) / 16 - Math.PI / 2
    const r = i % 2 === 0 ? c : c * 0.38
    pts.push(`${c + r * Math.cos(ang)},${c + r * Math.sin(ang)}`)
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts.join(' ')} fill={color} />
    </svg>
  )
}

// Ribbed chrome pillar — a short stack of horizontal metallic rings, sitting
// where the dome curve meets the straight sides, like the reference's posts
function ChromePillar() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          width: 46, height: 13, borderRadius: 7,
          background: `linear-gradient(90deg, ${CHROME_DARK} 0%, ${CHROME_FLAT} 30%, #fff8e8 50%, ${CHROME_FLAT} 70%, ${CHROME_DARK} 100%)`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }} />
      ))}
    </div>
  )
}

// The flat rainbow picture-frame border, with a star badge at the peak and
// chrome pillars where the dome meets the straight sides — matching the
// reference far more closely than a plain striped ring.
// Dome sized to actually hold the 3-line title inside its cream cap,
// instead of a shallow sliver with the title crammed below it.
const DOME_RATIO = 0.38

function DinerFrame({ children }: { children: React.ReactNode }) {
  const archTopPad = 20
  const maxVR = BANDS[0].r * DOME_RATIO
  const archH = archTopPad + maxVR
  const cx = FRAME_MAX / 2

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: FRAME_MAX, margin: '0 auto' }}>
      {/* Peak badge */}
      <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <div style={{
          width: 84, height: 60, background: `linear-gradient(180deg, ${RED}, #8a1815)`,
          border: `3px solid ${CHROME_FLAT}`, borderRadius: '6px',
          clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Starburst size={32} color="white" />
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
        {/* White pinstripe trim between each color band */}
        {BANDS.map((b, i) => {
          const vr = (b.r - 4) * DOME_RATIO
          return (
            <div key={`ws${i}`} style={{
              position: 'absolute', width: (b.r - 4) * 2, height: vr * 2, borderRadius: '50%',
              top: archTopPad + maxVR - vr, left: cx - (b.r - 4), border: '2px solid rgba(255,255,255,0.55)',
            }} />
          )
        })}
        <div style={{
          position: 'absolute', width: CONTENT_R * 2, height: CONTENT_R * DOME_RATIO * 2, borderRadius: '50%',
          top: archTopPad + maxVR - CONTENT_R * DOME_RATIO, left: cx - CONTENT_R, background: CREAM,
        }} />

        {/* Title, sitting directly inside the cream dome */}
        <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', padding: '0 70px' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.3em', color: TEAL, fontWeight: 700 }}>WELCOME TO</p>
          <h1 className="font-retro" style={{ fontSize: 34, fontStyle: 'italic', fontWeight: 700, color: RED, lineHeight: 1.1 }}>The Outside Inn</h1>
          <p style={{ fontSize: 18, letterSpacing: '0.3em', color: TEAL, fontWeight: 800, marginTop: 2 }}>JUKEBOX</p>
        </div>

        {/* Small star sparkles beside the title */}
        <div style={{ position: 'absolute', bottom: 58, left: cx - 190 }}><Starburst size={14} color={RED} /></div>
        <div style={{ position: 'absolute', bottom: 58, right: cx - 190 }}><Starburst size={14} color={RED} /></div>
      </div>

      {/* Chrome pillars at the springing point of the dome */}
      <div style={{ position: 'absolute', top: archH - 40, left: cx - BANDS[0].r - 32, zIndex: 4 }}><ChromePillar /></div>
      <div style={{ position: 'absolute', top: archH - 40, right: cx - BANDS[0].r - 32, zIndex: 4 }}><ChromePillar /></div>

      {/* Straight sides continuing down from the dome */}
      <div style={{ position: 'relative' }}>
        {BANDS.map((b, i) => {
          const inner = i < BANDS.length - 1 ? BANDS[i + 1].r : CONTENT_R
          return <div key={`l${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: cx - b.r, width: b.r - inner, background: b.color }} />
        })}
        {BANDS.map((b, i) => {
          const inner = i < BANDS.length - 1 ? BANDS[i + 1].r : CONTENT_R
          return <div key={`r${i}`} style={{ position: 'absolute', top: 0, bottom: 0, right: cx - b.r, width: b.r - inner, background: b.color }} />
        })}
        {/* White pinstripes running down the sides, between each band */}
        {BANDS.map((b, i) => (
          <div key={`wl${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: cx - b.r + 2, width: 2, background: 'rgba(255,255,255,0.55)' }} />
        ))}
        {BANDS.map((b, i) => (
          <div key={`wr${i}`} style={{ position: 'absolute', top: 0, bottom: 0, right: cx - b.r + 2, width: 2, background: 'rgba(255,255,255,0.55)' }} />
        ))}
        {/* Cream cabinet interior — light body, not a dark panel */}
        <div style={{ position: 'relative', margin: `0 ${FRAME_MAX / 2 - CONTENT_R}px`, background: CREAM, minHeight: 40 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// Pill-shaped list button
function PillButton({ label, dotColor, onClick, disabled, loading }: {
  label: string; dotColor: string; onClick: () => void; disabled?: boolean; loading?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="active:scale-[0.97] transition-transform"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 18px',
        borderRadius: 999, border: 'none', background: CREAM,
        opacity: disabled && !loading ? 0.4 : 1, transition: 'opacity 0.2s',
      }}>
      {loading
        ? <span className="skeleton" style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} />
        : <span style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: `0 0 6px ${dotColor}` }} />}
      <span style={{ fontSize: 15, fontWeight: 800, color: '#241a08' }}>{label}</span>
    </button>
  )
}

// Double-line section divider with a center label, matching the reference's
// "MOST POPULAR" banner treatment
function SectionDivider({ label, color }: { label: string; color: string }) {
  const lines = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: 2, background: `${color}88` }} />
      <div style={{ height: 2, background: `${color}44` }} />
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      {lines}
      <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color, whiteSpace: 'nowrap' }}>{label}</p>
      {lines}
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
    <div className="h-full flex flex-col overflow-hidden" style={{ color: CREAM, background: '#0a0500' }}>

      {/* ── Header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', maxWidth: FRAME_MAX, margin: '0 auto', padding: '20px 16px 8px' }}>
        <div style={{ justifySelf: 'start' }}>
          <ThemeSwitcher color="rgba(240,228,200,0.55)" menuBg="#1c0f06" accentColor={RED_LIGHT} border={`1px solid ${RED}55`} />
        </div>
        <div />
        <button onClick={() => { clearToken(); window.location.reload() }} style={{ justifySelf: 'end', color: 'rgba(240,228,200,0.4)', padding: 8 }}>
          <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
        <DinerFrame>

          {/* Turntable box */}
          <div style={{ margin: '0 16px 16px', borderRadius: 14, background: '#050300', border: '3px solid rgba(255,255,255,0.85)', boxShadow: `0 0 0 2px ${CHROME_FLAT}88`, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ width: 70 - i * 2, height: 5, borderRadius: 2, background: `rgba(240,228,200,${0.15 + i * 0.03})`, marginLeft: i }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={130} />
            </div>
            <div style={{ flexShrink: 0, borderRadius: 10, border: `2px solid ${RED}`, background: CREAM, padding: '8px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: RED, lineHeight: 1 }}>45</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#241a08', letterSpacing: '0.05em' }}>RPM</p>
            </div>
          </div>

          {/* Genres | Now Playing | Decades — three separate boxes, not merged */}
          <div className="grid grid-cols-[220px_1fr_220px] gap-3" style={{ margin: '0 16px 16px' }}>

            {/* Genres box */}
            <div style={{ borderRadius: 14, background: '#050300', border: '3px solid rgba(255,255,255,0.85)', boxShadow: `0 0 0 2px ${RED}88`, padding: '16px 14px' }}>
                <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, letterSpacing: '0.1em', color: TEAL_LIGHT, marginBottom: 10 }}>GENRES</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DINER_GENRES.map((g) => (
                    <PillButton key={g.label} label={g.label} dotColor={RED} onClick={() => handleGenreClick(g.label)} disabled={!!loadingGenre} loading={loadingGenre === g.label} />
                  ))}
                </div>
            </div>

              {/* Now Playing box */}
              <div style={{ borderRadius: 14, background: '#050300', border: '3px solid rgba(255,255,255,0.85)', boxShadow: `0 0 0 2px ${TEAL}88`, padding: '16px 18px' }}>
                <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, letterSpacing: '0.06em', color: TEAL_LIGHT, marginBottom: 10 }}>♫ NOW PLAYING ♫</p>

                <div onClick={() => setFullscreenOpen(true)} style={{ borderRadius: 10, background: '#000', border: `2px solid ${TEAL}55`, padding: '16px 14px', textAlign: 'center', marginBottom: 14, cursor: 'pointer' }}>
                  <h2 className="font-retro" style={{ fontSize: 18, fontStyle: 'italic', fontWeight: 700, color: TEAL_LIGHT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{currentTrack?.name ?? 'No track playing'}</h2>
                  <p style={{ fontSize: 13, color: TEAL_LIGHT, opacity: 0.7, marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {currentTrack ? currentTrack.artists.map(a => a.name).join(', ') : 'Select a song below'}
                  </p>
                </div>

                {currentTrack && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ height: 5, background: 'rgba(240,228,200,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: RED, borderRadius: 99, transition: 'width 0.5s linear' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(240,228,200,0.4)' }}>{formatDuration(progressMs)}</span>
                      <span style={{ fontSize: 11, color: 'rgba(240,228,200,0.4)' }}>{formatDuration(durationMs)}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                  <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(180deg, #9de8e8, ${TEAL})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${CHROME_FLAT}` }}>
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" /></svg>
                  </button>
                  <button onClick={togglePlay} className="active:scale-95" style={{ width: 60, height: 60, borderRadius: '50%', background: `linear-gradient(180deg, #ff9a8a, ${RED})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${CHROME_FLAT}`, boxShadow: `0 0 16px ${RED}88` }}>
                    {isPlaying
                      ? <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                      : <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
                  </button>
                  <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(180deg, #9de8e8, ${TEAL})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${CHROME_FLAT}` }}>
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
                  </button>
                </div>

                {/* Search with live dropdown */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, background: '#000', borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '18px 18px 0 0' : 22, border: `2px solid ${TEAL}44` }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: searchLoading ? TEAL_LIGHT : 'rgba(240,228,200,0.35)', flexShrink: 0 }}>
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
                      style={{ fontSize: 13, color: CREAM, caretColor: TEAL_LIGHT }}
                    />
                    {inlineQuery && <button onClick={() => { setInlineQuery(''); setInlineDropdown([]); setSearchError('') }} style={{ color: 'rgba(240,228,200,0.4)' }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>}
                  </div>

                  {(searchLoading || searchError) && inlineDropdown.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#0f0700', border: `2px solid ${TEAL}44`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '10px 14px' }}>
                      <p style={{ fontSize: 12, color: searchError ? '#ff8a8a' : 'rgba(240,228,200,0.4)' }}>{searchLoading ? 'Searching…' : searchError}</p>
                    </div>
                  )}

                  {inlineDropdown.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#0f0700', border: `2px solid ${TEAL}44`, borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                      {inlineDropdown.map((entry, i) => {
                        const isTrack = entry.type === 'track'
                        const isArtist = entry.type === 'artist'
                        const item = entry.item as SpotifyTrack & SpotifyArtist & SpotifyAlbum
                        const thumb = isArtist ? item.images?.[0]?.url : isTrack ? item.album?.images?.[item.album.images.length - 1]?.url : item.images?.[0]?.url
                        const sub = isTrack ? item.artists?.map((a: { name: string }) => a.name).join(', ') : isArtist ? 'Artist' : 'Album'
                        return (
                          <button key={i} onClick={() => handleInlineSelect(entry)} className="hover:bg-[rgba(42,138,138,0.14)] active:scale-[0.98] transition-all duration-150"
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', textAlign: 'left', background: 'rgba(42,138,138,0.06)', borderBottom: i < inlineDropdown.length - 1 ? `1px solid ${TEAL}33` : 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: isArtist ? '50%' : 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(42,138,138,0.1)', border: `1px solid ${TEAL}55` }}>
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

              {/* Decades box */}
              <div style={{ borderRadius: 14, background: '#050300', border: '3px solid rgba(255,255,255,0.85)', boxShadow: `0 0 0 2px ${TEAL}88`, padding: '16px 14px' }}>
                <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, letterSpacing: '0.1em', color: TEAL_LIGHT, marginBottom: 10 }}>DECADES</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DECADES.map((dec) => (
                    <PillButton key={dec} label={`'${dec}`} dotColor={RED} onClick={() => handleDecadePlay(dec)} disabled={!!loadingDecade} loading={loadingDecade === dec} />
                  ))}
                </div>
              </div>
          </div>

          {/* Recently Played + Popular Artists */}
          <div style={{ margin: '0 16px 20px', borderRadius: 14, background: '#050300', border: '3px solid rgba(255,255,255,0.85)', boxShadow: `0 0 0 2px ${RED}88`, padding: '18px' }}>

            {playHistory.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <SectionDivider label="RECENTLY PLAYED" color={RED_LIGHT} />
                <div className="scrollbar-none" style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                  {playHistory.map(track => (
                    <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else addToQueue(track) }}
                      style={{ flexShrink: 0, width: 118, textAlign: 'left' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 118, height: 118, borderRadius: 8, overflow: 'hidden', marginBottom: 6, border: '2px solid rgba(255,255,255,0.8)' }}>
                        <img src={getAlbumArt(track, 'md')} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 11, color: TEAL_LIGHT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {popularArtists.length > 0 && (
              <div>
                <SectionDivider label="POPULAR ARTISTS" color={TEAL_LIGHT} />
                <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
                  {popularArtists.map(artist => (
                    <button key={artist.id} onClick={() => { setActiveArtist({ id: artist.id, name: artist.name, imageUrl: artist.images?.[0]?.url }); setActiveView('artist') }}
                      style={{ flexShrink: 0, width: 92, textAlign: 'center' }} className="active:scale-95 transition-transform">
                      <div style={{ width: 92, height: 92, borderRadius: '50%', overflow: 'hidden', marginBottom: 6, border: '2px solid rgba(255,255,255,0.8)' }}>
                        {artist.images?.[0]?.url
                          ? <img src={artist.images[0].url} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0700' }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, color: CREAM }}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" /></svg>
                            </div>}
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {popularArtists.length === 0 && playHistory.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(240,228,200,0.35)', padding: '10px 0' }}>
                Play a few songs and they'll show up here.
              </p>
            )}
          </div>

        </DinerFrame>
      </div>
    </div>
  )
}
