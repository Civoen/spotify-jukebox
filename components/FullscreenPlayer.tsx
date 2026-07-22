'use client'

import { useJukeboxStore } from '@/lib/store'
import { playTrack, formatDuration, previousTrack as prevTrackApi } from '@/lib/spotify'
import { globalPlayer } from './SpotifyPlayer'

// Blue palette for the fullscreen player
const BLUE = '#4ea8de'
const BLUE_LIGHT = '#bfe3ff'
const BLUE_DIM = 'rgba(78,168,222,0.15)'

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
        background: 'radial-gradient(ellipse at 50% 32%, rgba(20,60,100,0.85) 0%, transparent 60%), #060d18',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px 0',
      }}
    >
      <p className="font-typewriter" style={{ fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase', color: BLUE }}>Now Playing</p>

      <div style={{
        width: 'min(78vw, 600px)', height: 'min(78vw, 600px)', marginTop: 44,
        borderRadius: 30, overflow: 'hidden', flexShrink: 0,
        border: '3px solid #bfe3ff',
        boxShadow: '0 0 60px rgba(78,168,222,0.4), 0 24px 70px rgba(0,0,0,0.6)',
        background: BLUE_DIM,
      }}>
        {albumArt
          ? <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.2, color: BLUE }}><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
            </div>}
      </div>

      <h1 className="font-retro" style={{ fontSize: 40, fontStyle: 'italic', fontWeight: 700, color: '#eaf5ff', marginTop: 40, textAlign: 'center' }}>
        {currentTrack?.name ?? 'No track playing'}
      </h1>
      <p className="font-typewriter" style={{ fontSize: 22, color: BLUE, marginTop: 10, textAlign: 'center' }}>
        {currentTrack?.artists.map(a => a.name).join(', ') ?? 'Select a song to get started'}
      </p>

      {currentTrack && (
        <div style={{ width: 'min(84vw, 620px)', marginTop: 44 }}>
          <div style={{ height: 6, background: 'rgba(78,168,222,0.15)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: BLUE, borderRadius: 99, transition: 'width 0.5s linear' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="font-typewriter" style={{ fontSize: 16, color: BLUE_LIGHT }}>{formatDuration(progressMs)}</span>
            <span className="font-typewriter" style={{ fontSize: 16, color: BLUE_LIGHT }}>{formatDuration(durationMs)}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 44 }}>
        <button onClick={(e) => { e.stopPropagation(); handlePrev() }} className="active:scale-95 transition-transform"
          style={{ width: 86, height: 86, borderRadius: '50%', border: '2px solid rgba(78,168,222,0.5)', color: BLUE, background: 'rgba(78,168,222,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="3" height="9" rx="1" fill="currentColor" /><path d="M12 2.5L6 7L12 11.5V2.5Z" fill="currentColor" opacity="0.7" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="active:scale-95"
          style={{ width: 120, height: 120, borderRadius: '50%', background: BLUE, color: '#06121f', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(78,168,222,0.6), 0 6px 18px rgba(0,0,0,0.7)', border: '3px solid rgba(191,227,255,0.4)' }}>
          {isPlaying
            ? <svg width="38" height="38" viewBox="0 0 18 18" fill="currentColor"><rect x="3" y="2" width="4" height="14" rx="1.5" /><rect x="11" y="2" width="4" height="14" rx="1.5" /></svg>
            : <svg width="38" height="38" viewBox="0 0 18 18" fill="currentColor"><path d="M4 3L16 9L4 15V3Z" /></svg>}
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleSkip() }} className="active:scale-95 transition-transform"
          style={{ width: 86, height: 86, borderRadius: '50%', border: '2px solid rgba(78,168,222,0.5)', color: BLUE, background: 'rgba(78,168,222,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 14 14" fill="none"><path d="M2 2.5L8 7L2 11.5V2.5Z" fill="currentColor" opacity="0.7" /><rect x="9" y="2.5" width="3" height="9" rx="1" fill="currentColor" /></svg>
        </button>
      </div>

      <p className="font-typewriter" style={{ fontSize: 14, color: 'rgba(191,227,255,0.5)', marginTop: 40 }}>tap anywhere to go back</p>

      {/* Next Up bar */}
      {nextUp.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', marginTop: 'auto', padding: '18px 24px 22px', cursor: 'default' }}
        >
          <p className="font-typewriter" style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(191,227,255,0.5)', marginBottom: 12, textAlign: 'center' }}>Next Up</p>
          <div className="scrollbar-none" style={{ display: 'flex', gap: 12, overflowX: 'auto', justifyContent: 'center' }}>
            {nextUp.map((track) => (
              <div key={track.queueId} style={{ flexShrink: 0, width: 84, textAlign: 'center' }}>
                <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', marginBottom: 6, background: 'rgba(78,168,222,0.08)', border: '1px solid rgba(78,168,222,0.3)' }}>
                  {track.album.images?.[0]?.url && (
                    <img src={track.album.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <p className="font-typewriter" style={{ fontSize: 11, color: '#eaf5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
