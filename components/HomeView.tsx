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
