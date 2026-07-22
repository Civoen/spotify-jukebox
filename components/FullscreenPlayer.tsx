'use client'

import { useJukeboxStore } from '@/lib/store'
import { playTrack, formatDuration, previousTrack as prevTrackApi } from '@/lib/spotify'
import { globalPlayer } from './SpotifyPlayer'

const chromeH = 'linear-gradient(90deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'

export default function FullscreenPlayer() {
  const {
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs,
    accessToken, deviceId, skipNext, queue, contextQueue, setFullscreenOpen,
  } = useJukeboxStore()

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
  const nextUp = [...queue, ...contextQueue].slice(0, 6)

  return (
    <div
      onClick={() => setFullscreenOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, cursor: 'pointer',
        background: 'radial-gradient(ellipse at 50% 28%, rgba(58,42,8,0.9) 0%, transparent 60%), #0e0800',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 24px 0',
      }}
    >
      <p className="font-typewriter" style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--retro-gold)' }}>Now Playing</p>

      <div style={{
        width: 'min(70vw, 520px)', height: 'min(70vw, 520px)', marginTop: 40,
        borderRadius: 28, overflow: 'hidden', flexShrink: 0,
        border: '3px solid #e8d5b0',
        boxShadow: '0 0 50px rgba(201,162,39,0.35), 0 20px 60px rgba(0,0,0,0.6)',
        background: 'rgba(201,162,39,0.08)',
      }}>
        {albumArt
          ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="72" height="72" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: 'var(--retro-gold)' }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
            </div>}
      </div>

      <h1 className="font-retro" style={{ fontSize: 34, fontStyle: 'italic', fontWeight: 700, color: 'var(--retro-cream)', marginTop: 36, textAlign: 'center' }}>
        {currentTrack?.name ?? 'No track playing'}
      </h1>
      <p className="font-typewriter" style={{ fontSize: 19, color: 'var(--retro-gold)', marginTop: 8, textAlign: 'center' }}>
        {currentTrack?.artists.map(a => a.name).join(', ') ?? 'Select a song to get started'}
      </p>

      {currentTrack && (
        <div style={{ width: 'min(80vw, 560px)', marginTop: 40 }}>
          <div style={{ height: 6, background: 'rgba(201,162,39,0.15)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--retro-gold)', borderRadius: 99, transition: 'width 0.5s linear' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="font-typewriter" style={{ fontSize: 15, color: 'var(--retro-muted)' }}>{formatDuration(progressMs)}</span>
            <span className="font-typewriter" style={{ fontSize: 15, color: 'var(--retro-muted)' }}>{formatDuration(durationMs)}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 40 }}>
        <button onClick={(e) => { e.stopPropagation(); handlePrev() }} className="active:scale-95 transition-transform"
          style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.4)', color: 'var(--retro-gold)', background: 'rgba(201,162,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="active:scale-95"
          style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--retro-gold)', color: '#0e0800', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(201,162,39,0.55), 0 4px 14px rgba(0,0,0,0.7)', border: '3px solid rgba(255,240,180,0.35)' }}>
          {isPlaying
            ? <svg width="34" height="34" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
            : <svg width="34" height="34" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleSkip() }} className="active:scale-95 transition-transform"
          style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid rgba(201,162,39,0.4)', color: 'var(--retro-gold)', background: 'rgba(201,162,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
        </button>
      </div>

      <p className="font-typewriter" style={{ fontSize: 14, color: 'var(--retro-muted)', marginTop: 44 }}>tap anywhere to go back</p>

      {/* Next Up bar */}
      {nextUp.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', marginTop: 'auto', padding: '18px 24px 22px', cursor: 'default' }}
        >
          <p className="font-typewriter" style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--retro-muted)', marginBottom: 12, textAlign: 'center' }}>Next Up</p>
          <div className="scrollbar-none" style={{ display: 'flex', gap: 12, overflowX: 'auto', justifyContent: nextUp.length <= 4 ? 'center' : 'flex-start' }}>
            {nextUp.map((track) => (
              <div key={track.queueId} style={{ flexShrink: 0, width: 84, textAlign: 'center' }}>
                <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', marginBottom: 6, background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.25)' }}>
                  {track.album.images?.[0]?.url && (
                    <img src={track.album.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <p className="font-typewriter" style={{ fontSize: 11, color: 'var(--retro-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
