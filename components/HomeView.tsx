'use client'

import { useEffect, useState, useRef } from 'react'
import { useJukeboxStore } from '@/lib/store'
import {
  searchAll, clearToken, formatDuration, searchDecadeSongs,
  previousTrack as prevTrackApi, findOrCreateJukeboxPlaylist, addTrackToJukeboxPlaylist,
  type SpotifyTrack, type SpotifyArtist, type SpotifyAlbum,
} from '@/lib/spotify'
import { DECADE_SONGS } from '@/lib/decade-tracks'
import { GENRES } from '@/lib/genres'
import { globalPlayer } from './SpotifyPlayer'
import { playTrack } from '@/lib/spotify'
import SpinningVinyl from './SpinningVinyl'
import TrackRow from './TrackRow'

function rowLabel(i: number) {
  return `${String.fromCharCode(65 + Math.floor(i / 9))}${(i % 9) + 1}`
}

const chrome = 'linear-gradient(180deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'
const chromeH = 'linear-gradient(90deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'

/* ─── Curved title — a bold marquee arc, bent to match the jukebox dome's own curve ─── */
function CurvedTitle() {
  // Radius matches the dome's outer chrome ring (~500px) so the bend genuinely
  // resembles the jukebox's own arch, not just a generic gentle curve.
  const svgWidth = 760
  const svgHeight = 250
  const chordInset = 30
  const baselineY = 235
  const archRadius = 520
  const pathId = 'curved-title-path'

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <path
          id={pathId}
          d={`M ${chordInset} ${baselineY} A ${archRadius} ${archRadius} 0 0 1 ${svgWidth - chordInset} ${baselineY}`}
          fill="none"
        />
        <linearGradient id="curved-title-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8d5b0" />
          <stop offset="20%" stopColor="#c9a460" />
          <stop offset="50%" stopColor="#f5e8c0" />
          <stop offset="80%" stopColor="#b8902a" />
          <stop offset="100%" stopColor="#e0c878" />
        </linearGradient>
      </defs>
      <text
        fontSize={70}
        fontWeight={900}
        letterSpacing="-0.01em"
        fill="url(#curved-title-grad)"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          Outside Inn Jukebox
        </textPath>
      </text>
    </svg>
  )
}

/* ─── Arch crown ─── */
function ArchCrown({ albumArt, isPlaying, vinylSize = 880, topPad = 0, vinylScale = 1 }: {
  albumArt?: string; isPlaying: boolean; vinylSize?: number; topPad?: number; vinylScale?: number
}) {
  const vR = vinylSize / 2
  const vCenterY = topPad + vR
  const archH = topPad + vR
  // Scaled vinyl dims — keep centred on same vCenterY
  const scaledVinylSize = vinylSize * vinylScale
  const scaledVR = scaledVinylSize / 2
  const vinylTop = vCenterY - scaledVR

  // Circular ring: each layer is a full circle centered on the vinyl center,
  // with radius = vinyl radius + gap. Painted large-to-small to create rings.
  const ring = (gap: number, bg: string, extra?: React.CSSProperties) => {
    const d = (vR + gap) * 2
    return {
      position: 'absolute' as const,
      width: d, height: d,
      borderRadius: '50%',
      top: vCenterY - (vR + gap),
      left: '50%',
      transform: 'translateX(-50%)',
      background: bg,
      ...extra,
    }
  }

  return (
    <div style={{ position: 'relative', height: archH, flexShrink: 0, overflow: 'hidden' }}>
      {/* Chrome outer ring */}
      <div style={ring(60, chromeH)} />
      <div style={ring(50, '#050200')} />
      {/* Pink neon */}
      <div style={ring(44, '#ff2d78', { boxShadow: '0 0 16px 5px #ff2d7866', animation: 'neon-pulse 2.5s ease-in-out 0s infinite' })} />
      <div style={ring(38, '#050200')} />
      {/* Cyan neon */}
      <div style={ring(32, '#00d4ff', { boxShadow: '0 0 14px 4px #00d4ff55', animation: 'neon-pulse 2.8s ease-in-out 1.2s infinite' })} />
      <div style={ring(26, '#050200')} />
      {/* Inner chrome ring */}
      <div style={ring(20, chromeH, { opacity: 0.85 })} />
      <div style={ring(14, '#050200')} />
      {/* Gold accent */}
      <div style={ring(8, '#c9a227', { opacity: 0.55 })} />
      {/* Dark interior */}
      <div style={ring(2, '#030100')} />

      {/* Vinyl */}
      <div style={{ position: 'absolute', top: vinylTop, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
        <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={scaledVinylSize} />
      </div>

    </div>
  )
}

/* ─── Chrome strip ─── */
function ChromeStrip({ height = 8, opacity = 1 }: { height?: number; opacity?: number }) {
  return <div style={{ height, width: '100%', flexShrink: 0, background: chromeH, opacity }} />
}

/* ─── Speaker grille ─── */
function SpeakerGrille({ rows = 4, cols = 12 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, padding: '12px 18px', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 4 }}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(201,162,39,0.28)', boxShadow: '0 0 3px rgba(201,162,39,0.18)' }} />
      ))}
    </div>
  )
}

/* ─── Neon wave grille ─── */
const WAVE_HEIGHTS = [0.25, 0.45, 0.70, 0.55, 0.85, 0.60, 0.95, 0.50, 0.80, 0.40, 0.65, 0.90, 0.35, 0.75, 0.55, 0.88]
function WaveGrille({ isPlaying, bars = 16 }: { isPlaying: boolean; bars?: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '14px 14px 10px', height: 96, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(201,162,39,0.22)', borderRadius: 6, overflow: 'hidden' }}>
      {Array.from({ length: bars }).map((_, i) => {
        const baseH = WAVE_HEIGHTS[i % WAVE_HEIGHTS.length]
        const delay = `${((i * 0.11) % 0.8).toFixed(2)}s`
        const duration = `${0.55 + (i % 6) * 0.12}s`
        return (
          <div key={i} style={{ flex: 1, borderRadius: 2, transformOrigin: 'bottom', background: isPlaying ? 'rgba(201,162,39,0.75)' : 'rgba(201,162,39,0.22)', boxShadow: isPlaying ? '0 0 4px rgba(201,162,39,0.4)' : 'none', height: `${baseH * 100}%`, animation: isPlaying ? `equalizer ${duration} ease-in-out ${delay} infinite` : 'none', transition: 'background 0.4s, box-shadow 0.4s' }} />
        )
      })}
    </div>
  )
}

/* ─── Volume dots ─── */
function VolumeControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const steps = [0.2, 0.4, 0.6, 0.8, 1.0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(201,162,39,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace' }}>vol</span>
        {steps.map((step) => {
          const active = volume >= step - 0.01
          return (
            <button
              key={step}
              onClick={() => onChange(step)}
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: active ? '#c9a227' : 'rgba(201,162,39,0.12)',
                border: `1px solid ${active ? 'rgba(201,162,39,0.8)' : 'rgba(201,162,39,0.25)'}`,
                boxShadow: active ? '0 0 8px 3px rgba(201,162,39,0.55)' : 'none',
                transition: 'all 0.15s',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ─── Knob ─── */
function Knob({ label, color = '#c9a227' }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #d4c090, #3a2808)', border: `2px solid ${color}55`, boxShadow: `0 3px 6px rgba(0,0,0,0.7), 0 0 8px ${color}20`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 3, height: 12, background: color, borderRadius: 2, opacity: 0.85 }} />
      </div>
      <span style={{ fontSize: 10, color: 'rgba(201,162,39,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{label}</span>
    </div>
  )
}

/* ─── Equalizer bars ─── */
function DecoEqualizer() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24, opacity: 0.55 }}>
      {[14, 8, 20, 10, 18, 6, 14].map((h, i) => (
        <div key={i} className="eq-bar" style={{ width: 5, height: h, borderRadius: 3, background: i % 3 === 0 ? '#ff2d78' : i % 3 === 1 ? '#c9a227' : '#00d4ff', animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

export default function HomeView() {
  const {
    accessToken, deviceId, setActiveView, setActivePlaylist, setActiveArtist, setActiveAlbum,
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs, queue, contextQueue, skipNext, addToQueue,
    playHistory, addToHistory, setKeyboardVisible, setOnKeyPress,
    volume, setVolume, setSearchQuery,
  } = useJukeboxStore()

  const [loading, setLoading] = useState(true)
  const [loadingDecade, setLoadingDecade] = useState<string | null>(null)

  // Inline search dropdown
  const [inlineQuery, setInlineQuery] = useState('')
  const inlineQueryRef = useRef('')
  const [inlineDropdown, setInlineDropdown] = useState<{ type: 'track' | 'artist' | 'album'; item: SpotifyTrack | SpotifyArtist | SpotifyAlbum }[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const inlineDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLoad = useRef(false)
  const jukeboxPlaylistId = useRef<string | null>(null)

  useEffect(() => {
    if (!accessToken || didLoad.current) return
    didLoad.current = true
    setLoading(false) // No playlist fetch, just mark not loading
  }, [accessToken])

  // Track play history locally + auto-add to yearly playlist
  useEffect(() => {
    if (!currentTrack || !accessToken) return
    addToHistory(currentTrack)
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
      // Fisher-Yates shuffle
      const shuffled = [...tracks]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      const { currentTrack: ct, deviceId: did, setContextQueue } = useJukeboxStore.getState()
      if (ct) {
        // Song playing — this decade becomes the new fallback playlist,
        // picking up right after any user-queued songs finish
        setContextQueue(shuffled)
      } else if (did) {
        // Nothing playing and device ready — play first, queue rest as fallback
        setContextQueue(shuffled.slice(1))
        playTrack(accessToken, shuffled[0].uri, did)
      } else {
        // Device not ready yet — load fallback queue so it's ready to go
        setContextQueue(shuffled)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDecade(null)
    }
  }

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
        // Interleave all types and take the top 3 most relevant
        const pool: typeof inlineDropdown = []
        for (let i = 0; i < 3; i++) {
          if (tracks[i])  pool.push({ type: 'track',  item: tracks[i] })
          if (artists[i]) pool.push({ type: 'artist', item: artists[i] })
          if (albums[i])  pool.push({ type: 'album',  item: albums[i] })
        }
        setInlineDropdown(pool.slice(0, 3))
        setSearchError(pool.length === 0 ? 'No results found' : '')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Search failed'
        const is429 = msg.includes('429')
        setSearchError(is429 ? 'Rate limited — retrying…' : 'Search failed')
        setInlineDropdown([])
        if (is429) {
          // Auto-retry once after Spotify's typical rate-limit window
          inlineDebounce.current = setTimeout(async () => {
            try {
              setSearchError('')
              setSearchLoading(true)
              const { tracks, artists, albums } = await searchAll(inlineQuery, accessToken)
              const pool: typeof inlineDropdown = []
              for (let i = 0; i < 3; i++) {
                if (tracks[i])  pool.push({ type: 'track',  item: tracks[i] })
                if (artists[i]) pool.push({ type: 'artist', item: artists[i] })
                if (albums[i])  pool.push({ type: 'album',  item: albums[i] })
              }
              setInlineDropdown(pool.slice(0, 3))
              setSearchError(pool.length === 0 ? 'No results found' : '')
            } catch {
              setSearchError('Too many requests — wait a moment')
              setInlineDropdown([])
            } finally {
              setSearchLoading(false)
            }
          }, 5000)
        }
      } finally {
        setSearchLoading(false)
      }
    }, 1600)
    return () => { if (inlineDebounce.current) clearTimeout(inlineDebounce.current) }
  }, [inlineQuery, accessToken])

  const handleInlineSelect = (entry: typeof inlineDropdown[0]) => {
    setInlineQuery('')
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

  const handleVolume = (v: number) => {
    setVolume(v)
    globalPlayer?.setVolume(v)
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
      prevTrackApi(accessToken, deviceId ?? undefined)
        .catch(() => globalPlayer?.previousTrack())
    } else {
      globalPlayer?.previousTrack()
    }
  }

  const progress = durationMs > 0 ? (progressMs / durationMs) * 100 : 0
  const albumArt = currentTrack?.album.images?.[0]?.url

  // Content padding aligns with inner edge of arch rings (vR=440, gap=2 → 442px from center)
  // max() ensures at least 16px on narrow screens where rings are off-screen
  const pad = 'max(16px, calc(50% - 432px))'
  // Negative pad for edge-to-edge horizontal scrollers
  const negPad = 'min(-16px, calc(432px - 50%))'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--retro-cream)' }}>


      {/* ── Top header ── */}
      <div style={{ flexShrink: 0 }}>
        <ChromeStrip height={10} opacity={0.8} />
        <div style={{ display: 'flex', height: 12 }}>
          <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #ff2d7855, transparent)' }} />
          <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #c9a22777, transparent)' }} />
          <div style={{ flex: 1, background: 'linear-gradient(90deg, transparent, #00d4ff55, transparent)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', padding: `12px ${pad} 0` }}>
          <div />
          <CurvedTitle />
          <button onClick={() => { clearToken(); window.location.reload() }} style={{ justifySelf: 'end', marginTop: 16, color: 'rgba(201,162,39,0.45)', padding: 8 }}>
            <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <>
          {/* Arch — sits above the scrollable body, doesn't scroll */}
          <div style={{ flexShrink: 0, marginTop: -20 }}>
            <ArchCrown albumArt={albumArt} isPlaying={isPlaying} vinylSize={880} topPad={100} vinylScale={0.9} />
          </div>
          {/* Neon separator under arch — clipped to jukebox body width (500px from center each side) */}
          <div style={{ flexShrink: 0, margin: '0 max(0px, calc(50% - 500px))' }}>
            <div style={{ height: 3, background: chromeH, opacity: 0.75 }} />
            <div style={{ height: 2, background: '#050200' }} />
            <div style={{ height: 3, background: '#ff2d78', opacity: 0.6, boxShadow: '0 0 8px 2px #ff2d7866', animation: 'neon-pulse 2.5s ease-in-out infinite' }} />
            <div style={{ height: 2, background: '#050200' }} />
            <div style={{ height: 3, background: '#00d4ff', opacity: 0.6, boxShadow: '0 0 8px 2px #00d4ff66', animation: 'neon-pulse 2.8s ease-in-out 1.2s infinite' }} />
            <div style={{ height: 2, background: '#050200' }} />
            <div style={{ height: 3, background: chromeH, opacity: 0.65 }} />
            <div style={{ height: 2, background: '#050200' }} />
            <div style={{ height: 3, background: '#c9a227', opacity: 0.45 }} />
          </div>

          {/* Jukebox body — bordered section aligned with arch curve sides */}
          {/* Strip positions use calc(50% - Xpx) matching arch ring radii at equator (vR=440) */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Left border strips — gap values: 60,50,44,38,32,26,20,14,8,2 → radii 500,490,484,478,472,466,460,454,448,442 */}
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 500px)', bottom: 0, width: 10, background: chrome,    opacity: 0.75, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 490px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 484px)', bottom: 0, width: 6,  background: '#ff2d78', opacity: 0.6, boxShadow: '2px 0 10px 2px #ff2d7855', zIndex: 10, pointerEvents: 'none', animation: 'neon-pulse 2.5s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 478px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 472px)', bottom: 0, width: 6,  background: '#00d4ff', opacity: 0.6, boxShadow: '2px 0 10px 2px #00d4ff55', zIndex: 10, pointerEvents: 'none', animation: 'neon-pulse 2.8s ease-in-out 1.2s infinite' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 466px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 460px)', bottom: 0, width: 6,  background: chrome,    opacity: 0.65, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 454px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 448px)', bottom: 0, width: 6,  background: '#c9a227', opacity: 0.45, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 442px)', bottom: 0, width: 2,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            {/* Right border strips (mirrored) */}
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 500px)', bottom: 0, width: 10, background: chrome,    opacity: 0.75, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 490px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 484px)', bottom: 0, width: 6,  background: '#ff2d78', opacity: 0.6, boxShadow: '-2px 0 10px 2px #ff2d7855', zIndex: 10, pointerEvents: 'none', animation: 'neon-pulse 2.5s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 478px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 472px)', bottom: 0, width: 6,  background: '#00d4ff', opacity: 0.6, boxShadow: '-2px 0 10px 2px #00d4ff55', zIndex: 10, pointerEvents: 'none', animation: 'neon-pulse 2.8s ease-in-out 1.2s infinite' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 466px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 460px)', bottom: 0, width: 6,  background: chrome,    opacity: 0.65, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 454px)', bottom: 0, width: 6,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 448px)', bottom: 0, width: 6,  background: '#c9a227', opacity: 0.45, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 'calc(50% - 442px)', bottom: 0, width: 2,  background: '#050200', zIndex: 10, pointerEvents: 'none' }} />

            {/* ── Now playing — fixed, does not scroll ── */}
            <div style={{ flexShrink: 0, position: 'relative', padding: `18px ${pad} 14px`, background: 'linear-gradient(180deg, rgba(20,10,2,0.98), rgba(14,8,0,1))' }}>

              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                {currentTrack ? (
                  <>
                    <h2 className="font-retro" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 6, color: 'var(--retro-cream)' }}>{currentTrack.name}</h2>
                    <p className="font-typewriter" style={{ fontSize: 17, color: 'var(--retro-gold)' }}>
                      {currentTrack.artists.map((a, i) => (
                        <span key={a.id}>{i > 0 && ' & '}<button onClick={() => { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }} className="hover:underline transition-colors">{a.name}</button></span>
                      ))}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-retro" style={{ fontSize: 26, fontWeight: 700, color: 'var(--retro-muted)' }}>No track playing</h2>
                    <p className="font-typewriter" style={{ fontSize: 16, marginTop: 6, color: 'var(--retro-muted)' }}>Select a song below</p>
                  </>
                )}
              </div>

              {currentTrack && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 6, background: 'rgba(201,162,39,0.12)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--retro-gold)', borderRadius: 99, transition: 'width 0.5s linear' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="font-typewriter" style={{ fontSize: 14, color: 'var(--retro-muted)' }}>{formatDuration(progressMs)}</span>
                    <span className="font-typewriter" style={{ fontSize: 14, color: 'var(--retro-muted)' }}>{formatDuration(durationMs)}</span>
                  </div>
                </div>
              )}

              {/* Row 1: wave grilles flanking playback buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <WaveGrille isPlaying={isPlaying} bars={16} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <button onClick={handlePrev} className="active:scale-95 transition-transform" style={{ width: 58, height: 58, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.35)', color: 'var(--retro-gold)', background: 'rgba(201,162,39,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
                  </button>
                  <button onClick={togglePlay} className="active:scale-95" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--retro-gold)', color: '#0e0800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 20px rgba(201,162,39,0.5), 0 3px 10px rgba(0,0,0,0.7)', border: '3px solid rgba(255,240,180,0.3)', transition: 'transform 0.1s' }}>
                    {isPlaying
                      ? <svg width="26" height="26" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
                      : <svg width="26" height="26" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
                  </button>
                  <button onClick={handleSkip} className="active:scale-95 transition-transform" style={{ width: 58, height: 58, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.35)', color: 'var(--retro-gold)', background: 'rgba(201,162,39,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
                  </button>
                </div>
                <WaveGrille isPlaying={isPlaying} bars={16} />
              </div>

              {/* Row 2: volume dots only */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 10 }}>
                <VolumeControl volume={volume} onChange={handleVolume} />
              </div>
            </div>

            {/* Search bar — fixed, does not scroll */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ margin: `0 ${pad}` }}><ChromeStrip height={8} opacity={0.5} /></div>
              <div style={{ padding: `10px ${pad}`, background: 'rgba(8,4,0,0.97)', position: 'relative' }}>
                <div style={{ padding: 2, borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '10px 10px 0 0' : 10, background: chromeH, boxShadow: '0 0 8px rgba(201,162,39,0.18)' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, background: 'rgba(10,5,0,0.97)', border: 'none', borderRadius: (inlineDropdown.length > 0 || searchError || searchLoading) ? '8px 8px 0 0' : 8 }}>
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ color: searchLoading ? 'var(--retro-gold)' : 'rgba(201,162,39,0.55)', flexShrink: 0 }}>
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
                      placeholder="Search the catalog…"
                      inputMode="none"
                      className="flex-1 bg-transparent outline-none font-typewriter"
                      style={{ fontSize: 16, color: 'var(--retro-cream)', caretColor: 'var(--retro-gold)' }}
                    />
                    {inlineQuery && <button onClick={() => { setInlineQuery(''); setInlineDropdown([]); setSearchError('') }} style={{ color: 'rgba(201,162,39,0.5)', padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>}
                  </div>
                  {(searchLoading || searchError) && inlineDropdown.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: -2, right: -2, zIndex: 50, padding: '0 2px 2px', background: chromeH, borderRadius: '0 0 10px 10px' }}>
                      <div style={{ background: 'rgba(10,5,0,0.99)', borderRadius: '0 0 8px 8px', padding: '12px 16px' }}>
                        <p className="font-typewriter" style={{ fontSize: 13, color: searchError ? '#ff6b6b' : 'var(--retro-muted)' }}>
                          {searchLoading ? 'Searching…' : searchError}
                        </p>
                      </div>
                    </div>
                  )}
                  {inlineDropdown.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: -2, right: -2, zIndex: 50, padding: '0 2px 2px', background: chromeH, borderRadius: '0 0 10px 10px' }}>
                    <div style={{ background: 'rgba(10,5,0,0.99)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                      {inlineDropdown.map((entry, i) => {
                        const isTrack = entry.type === 'track'
                        const isArtist = entry.type === 'artist'
                        const item = entry.item as SpotifyTrack & SpotifyArtist & SpotifyAlbum
                        const thumb = isArtist ? item.images?.[0]?.url : isTrack ? item.album?.images?.[item.album.images.length - 1]?.url : item.images?.[0]?.url
                        const title = item.name
                        const sub = isTrack ? item.artists?.map((a: { name: string }) => a.name).join(', ') : isArtist ? 'Artist' : 'Album'
                        return (
                          <button key={i} onClick={() => handleInlineSelect(entry)}
                            className="hover:bg-white/5 transition-colors"
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', width: '100%', textAlign: 'left', borderBottom: i < inlineDropdown.length - 1 ? '1px solid rgba(201,162,39,0.1)' : 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: isArtist ? '50%' : 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(201,162,39,0.1)' }}>
                              {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                              <p style={{ fontSize: 12, color: 'var(--retro-muted)', marginTop: 1 }}>{sub}{isTrack ? ' · tap to queue' : ' · tap to browse'}</p>
                            </div>
                            <span style={{ fontSize: 11, color: 'rgba(201,162,39,0.4)', fontFamily: 'monospace', textTransform: 'uppercase', flexShrink: 0 }}>{entry.type}</span>
                          </button>
                        )
                      })}
                    </div>
                    </div>
                  )}
                </div>
                </div>{/* end chrome gradient wrapper */}
              </div>
              <div style={{ margin: `0 ${pad}` }}><ChromeStrip height={8} opacity={0.5} /></div>
            </div>

            {/* Scrollable content inside the bordered body */}
            <div className="overflow-y-auto" style={{ flex: 1 }}>


          {(queue.length > 0 || contextQueue.length > 0) && (
            <div style={{ padding: `12px ${pad} 16px` }}>
              <p className="font-typewriter" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 10, color: 'var(--retro-muted)', letterSpacing: '0.08em' }}>Up Next</p>
              <div style={{ padding: 2, borderRadius: 8, background: chromeH, boxShadow: '0 0 8px rgba(201,162,39,0.15)' }}>
              <div style={{ borderRadius: 6, overflow: 'hidden', background: 'rgba(10,5,0,0.95)' }}>
                {(queue.length > 0 ? queue : contextQueue).slice(0, 1).map((track, i) => (
                  <div key={track.queueId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < queue.length - 1 ? '1px solid rgba(201,162,39,0.1)' : 'none', background: i % 2 === 0 ? 'rgba(201,162,39,0.03)' : 'transparent' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,162,39,0.12)', border: '1px solid rgba(201,162,39,0.25)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--retro-gold)' }}>{rowLabel(i)}</div>
                    <img src={(track.album.images ?? []).at(-1)?.url} alt="" style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0, objectFit: 'cover', opacity: 0.85 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                      <p style={{ fontSize: 13, color: 'var(--retro-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                    </div>
                    <span className="font-typewriter" style={{ fontSize: 13, color: 'var(--retro-muted)', flexShrink: 0 }}>{formatDuration(track.duration_ms)}</span>
                  </div>
                ))}
              </div>
              </div>{/* end chrome gradient wrapper */}
            </div>
          )}

          {/* Decade Playlists */}
          {(() => {
            const DECADE_COLORS: Record<string, { neon: string; neonDim: string; label: string }> = {
              '60s': { neon: '#f5a623', neonDim: 'rgba(245,166,35,0.18)', label: 'Sixties' },
              '70s': { neon: '#ff7b2e', neonDim: 'rgba(255,123,46,0.18)', label: 'Seventies' },
              '80s': { neon: '#ff2d78', neonDim: 'rgba(255,45,120,0.18)', label: 'Eighties' },
              '90s': { neon: '#00d4ff', neonDim: 'rgba(0,212,255,0.18)', label: 'Nineties' },
              '00s': { neon: '#b06cf5', neonDim: 'rgba(176,108,245,0.18)', label: 'Two-thousands' },
            }
            return (
              <div style={{ padding: `10px ${pad} 0`, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {(['60s', '70s', '80s', '90s', '00s'] as const).map((decade) => {
                  const isLoading = loadingDecade === decade
                  const { neon, neonDim } = DECADE_COLORS[decade]
                  return (
                    /* Gradient-border wrapper: chrome gradient bg + 2px padding = full chrome stroke */
                    <div
                      key={decade}
                      style={{
                        padding: 2,
                        borderRadius: 12,
                        background: isLoading ? neon : chromeH,
                        boxShadow: isLoading ? `0 0 20px ${neon}66` : '0 0 6px rgba(201,162,39,0.15)',
                        opacity: loadingDecade && !isLoading ? 0.35 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                    <button
                      onClick={() => handleDecadePlay(decade)}
                      disabled={!!loadingDecade}
                      className="active:scale-[0.97]"
                      style={{
                        width: '100%',
                        background: `linear-gradient(180deg, rgba(20,10,2,0.98) 0%, rgba(10,5,0,1) 100%)`,
                        borderRadius: 10,
                        padding: '18px 6px 14px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        transition: 'all 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        border: 'none',
                        boxShadow: isLoading
                          ? `inset 0 0 16px ${neonDim}`
                          : 'inset 0 0 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Neon colour wash at bottom */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: `linear-gradient(0deg, ${neonDim} 0%, transparent 100%)`, pointerEvents: 'none' }} />

                      {isLoading ? (
                        <>
                          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%', marginTop: 6 }} />
                          <span className="font-typewriter" style={{ fontSize: 9, color: neon, letterSpacing: '0.15em', opacity: 0.8 }}>LOADING…</span>
                        </>
                      ) : (
                        <>
                          {/* Vinyl record */}
                          <svg width="58" height="58" viewBox="0 0 64 64" style={{ marginTop: 4, filter: `drop-shadow(0 0 6px ${neon}55)` }}>
                            <defs>
                              <linearGradient id={`cg-${decade}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#e8d5b0" />
                                <stop offset="40%" stopColor="#f5e8c0" />
                                <stop offset="100%" stopColor="#b8902a" />
                              </linearGradient>
                            </defs>
                            {/* Outer chrome ring */}
                            <circle cx="32" cy="32" r="31" fill="#080400" stroke={`url(#cg-${decade})`} strokeWidth="2.5" />
                            {/* Groove rings */}
                            {[0.82, 0.70, 0.58, 0.46].map((r, i) => (
                              <circle key={i} cx="32" cy="32" r={31 * r} fill="none" stroke="rgba(201,162,39,0.12)" strokeWidth="1" />
                            ))}
                            {/* Neon label ring */}
                            <circle cx="32" cy="32" r="12" fill="rgba(0,0,0,0.7)" stroke={neon} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 3px ${neon})` }} />
                            {/* Center hole */}
                            <circle cx="32" cy="32" r="3.5" fill={neon} />
                          </svg>

                          <span className="font-retro" style={{ fontSize: 22, fontWeight: 900, color: neon, letterSpacing: '0.01em', textShadow: `0 0 14px ${neon}88`, lineHeight: 1 }}>&apos;{decade}</span>
                          <span className="font-typewriter" style={{ fontSize: 8, color: 'rgba(201,162,39,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Shuffle Play</span>
                        </>
                      )}
                    </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {playHistory.length > 0 && (
          <div style={{ padding: `12px ${pad} 14px` }}>
            <p className="font-typewriter" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 14, color: 'var(--retro-muted)', letterSpacing: '0.08em' }}>Recently Played</p>
              <div className="scrollbar-none" style={{ display: 'flex', gap: 14, overflowX: 'auto', margin: `0 ${negPad}`, padding: `0 ${pad} 8px` }}>
                {playHistory.map(track => (
                  <button key={track.id} onClick={() => { if (!currentTrack && accessToken && deviceId) playTrack(accessToken, track.uri, deviceId); else useJukeboxStore.getState().addToQueue(track) }}
                    style={{ flexShrink: 0, width: 150, textAlign: 'left' }} className="active:scale-95 transition-transform">
                    <div style={{ width: 150, height: 150, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.18)' }}>
                      {track.album.images[0]?.url ? <img src={track.album.images[0].url} alt={track.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="36" height="36" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: 'var(--retro-gold)' }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg></div>}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
                    <p style={{ fontSize: 13, color: 'var(--retro-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artists.map(a => a.name).join(', ')}</p>
                  </button>
                ))}
              </div>
          </div>
          )}

          {/* Genre buttons */}
          {(() => {
            const HOME_GENRES = GENRES.filter(g => ['Pop','Rock','Dance','Electronic','Metal'].includes(g.label))
            return (
              <div style={{ padding: `10px ${pad} 16px`, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {HOME_GENRES.map(({ label, neon, neonDim }) => (
                  <div
                    key={label}
                    style={{
                      padding: 2,
                      borderRadius: 12,
                      background: chromeH,
                      boxShadow: '0 0 6px rgba(201,162,39,0.15)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <button
                      onClick={() => { setSearchQuery(label); setActiveView('search') }}
                      className="active:scale-[0.97]"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(180deg, rgba(20,10,2,0.98) 0%, rgba(10,5,0,1) 100%)',
                        borderRadius: 10,
                        padding: '20px 6px 18px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        border: 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: `linear-gradient(0deg, ${neonDim} 0%, transparent 100%)`, pointerEvents: 'none' }} />
                      <span className="font-retro" style={{ fontSize: 16, fontWeight: 900, color: neon, letterSpacing: '0.01em', textShadow: `0 0 10px ${neon}88`, lineHeight: 1 }}>{label}</span>
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}

            </div>{/* end scrollable */}
          </div>{/* end body */}
      </>
    </div>
  )
}
