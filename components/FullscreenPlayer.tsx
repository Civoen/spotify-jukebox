'use client'

import { useEffect, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { playTrack, formatDuration, previousTrack as prevTrackApi } from '@/lib/spotify'
import { globalPlayer } from './SpotifyPlayer'

const FALLBACK_ACCENT = { r: 78, g: 168, b: 222 } // blue, used if color extraction isn't available

// Samples the album art on a hidden canvas and returns its average color,
// boosted a bit in saturation/brightness so it reads well as a UI accent
// rather than a muddy photo-average. Falls back to blue if anything goes
// wrong (e.g. the image host doesn't allow canvas pixel reads).
function useAccentColor(imageUrl: string | undefined) {
  const [accent, setAccent] = useState(FALLBACK_ACCENT)

  useEffect(() => {
    if (!imageUrl) { setAccent(FALLBACK_ACCENT); return }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const size = 48
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]
          count++
        }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count)

        // Boost saturation/brightness so it works as a punchy UI accent
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        const boost = 1.35
        r = Math.min(255, Math.round(min + (r - min) * boost))
        g = Math.min(255, Math.round(min + (g - min) * boost))
        b = Math.min(255, Math.round(min + (b - min) * boost))
        const brightness = (r + g + b) / 3
        if (brightness < 90) {
          const lift = 90 / (brightness || 1)
          r = Math.min(255, Math.round(r * lift)); g = Math.min(255, Math.round(g * lift)); b = Math.min(255, Math.round(b * lift))
        }

        if (!cancelled) setAccent({ r, g, b })
      } catch {
        if (!cancelled) setAccent(FALLBACK_ACCENT) // canvas read blocked (CORS) — fall back gracefully
      }
    }
    img.onerror = () => { if (!cancelled) setAccent(FALLBACK_ACCENT) }
    img.src = imageUrl
    return () => { cancelled = true }
  }, [imageUrl])

  return accent
}

export default function FullscreenPlayer() {
  const {
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs,
    accessToken, deviceId, skipNext, queue, contextQueue, setFullscreenOpen,
  } = useJukeboxStore()

  const albumArt = currentTrack?.album.images?.[0]?.url
  const { r, g, b } = useAccentColor(albumArt)
  const accent = `rgb(${r},${g},${b})`
  const accentSoft = `rgba(${r},${g},${b},0.15)`
  const accentDim = `rgba(${r},${g},${b},0.08)`
  const accentBorder = `rgba(${r},${g},${b},0.5)`
  const accentLight = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`

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
  const nextUp = [...queue, ...contextQueue].slice(0, 6)

  return (
    <div
      onClick={() => setFullscreenOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, cursor: 'pointer',
        background: `radial-gradient(ellipse at 50% 32%, ${accentSoft} 0%, transparent 60%), #060810`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px 0',
        transition: 'background 0.6s ease',
      }}
    >
      <p className="font-typewriter" style={{ fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, transition: 'color 0.6s ease' }}>Now Playing</p>

      <div style={{
        width: 'min(78vw, 600px)', height: 'min(78vw, 600px)', marginTop: 44,
        borderRadius: 30, overflow: 'hidden', flexShrink: 0,
        border: `3px solid ${accentLight}`,
        boxShadow: `0 0 60px ${accentSoft}, 0 24px 70px rgba(0,0,0,0.6)`,
        background: accentDim,
        transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
      }}>
        {albumArt
          ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: accent }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
            </div>}
      </div>

      <h1 style={{ fontSize: 40, fontWeight: 700, color: '#fff', marginTop: 40, textAlign: 'center' }}>
        {currentTrack?.name ?? 'No track playing'}
      </h1>
      <p style={{ fontSize: 22, color: accentLight, marginTop: 10, textAlign: 'center', transition: 'color 0.6s ease' }}>
        {currentTrack?.artists.map(a => a.name).join(', ') ?? 'Select a song to get started'}
      </p>

      {currentTrack && (
        <div style={{ width: 'min(84vw, 620px)', marginTop: 44 }}>
          <div style={{ height: 6, background: accentSoft, borderRadius: 99, overflow: 'hidden', marginBottom: 8, transition: 'background 0.6s ease' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: accent, borderRadius: 99, transition: 'width 0.5s linear, background 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="font-typewriter" style={{ fontSize: 16, color: accentLight }}>{formatDuration(progressMs)}</span>
            <span className="font-typewriter" style={{ fontSize: 16, color: accentLight }}>{formatDuration(durationMs)}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 44 }}>
        <button onClick={(e) => { e.stopPropagation(); handlePrev() }} className="active:scale-95 transition-transform"
          style={{ width: 86, height: 86, borderRadius: '50%', border: `2px solid ${accentBorder}`, color: accent, background: accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.6s ease, color 0.6s ease' }}>
          <svg width="30" height="30" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="active:scale-95"
          style={{ width: 120, height: 120, borderRadius: '50%', background: accent, color: '#06121f', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${accentSoft}, 0 6px 18px rgba(0,0,0,0.7)`, border: `3px solid ${accentBorder}`, transition: 'background 0.6s ease, box-shadow 0.6s ease' }}>
          {isPlaying
            ? <svg width="38" height="38" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
            : <svg width="38" height="38" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleSkip() }} className="active:scale-95 transition-transform"
          style={{ width: 86, height: 86, borderRadius: '50%', border: `2px solid ${accentBorder}`, color: accent, background: accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.6s ease, color 0.6s ease' }}>
          <svg width="30" height="30" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
        </button>
      </div>

      <p className="font-typewriter" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 40 }}>tap anywhere to go back</p>

      {/* Next Up bar */}
      {nextUp.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', marginTop: 'auto', padding: '18px 24px 22px', cursor: 'default' }}
        >
          <p className="font-typewriter" style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12, textAlign: 'center' }}>Next Up</p>
          <div className="scrollbar-none" style={{ display: 'flex', gap: 12, overflowX: 'auto', justifyContent: 'center' }}>
            {nextUp.map((track) => (
              <div key={track.queueId} style={{ flexShrink: 0, width: 84, textAlign: 'center' }}>
                <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', marginBottom: 6, background: accentDim, border: `1px solid ${accentBorder}`, transition: 'background 0.6s ease, border-color 0.6s ease' }}>
                  {track.album.images?.[0]?.url && (
                    <img src={track.album.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
