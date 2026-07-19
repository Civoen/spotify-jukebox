'use client'

import { useJukeboxStore } from '@/lib/store'
import { formatDuration } from '@/lib/spotify'
import { globalPlayer } from './SpotifyPlayer'
import { playTrack } from '@/lib/spotify'

export default function BottomPlayer() {
  const {
    currentTrack,
    isPlaying,
    progressMs,
    durationMs,
    setIsPlaying,
    queue,
    contextQueue,
    skipNext,
    accessToken,
    deviceId,
    setActiveView,
    setActiveArtist,
  } = useJukeboxStore()

  if (!currentTrack) return null

  const progress = durationMs > 0 ? (progressMs / durationMs) * 100 : 0
  const art = currentTrack.album.images?.[1]?.url || currentTrack.album.images?.[0]?.url

  const togglePlay = () => {
    if (isPlaying) {
      globalPlayer?.pause()
    } else {
      globalPlayer?.resume()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSkip = () => {
    const next = skipNext()
    if (next && accessToken && deviceId) {
      playTrack(accessToken, next.uri, deviceId)
    } else {
      globalPlayer?.nextTrack()
    }
  }

  return (
    <div
      className="flex-shrink-0 mx-3 mb-1 rounded-2xl glass border border-white/8 overflow-hidden cursor-pointer"
      onClick={() => setActiveView('home')}
    >
      {/* Progress bar at top */}
      <div className="h-0.5 bg-white/10 relative">
        <div
          className="absolute left-0 top-0 h-full bg-pink-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5">
        {art && (
          <img
            src={art}
            alt={currentTrack.album.name}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate leading-tight">{currentTrack.name}</p>
          <p className="text-white/40 text-xs truncate">
            {currentTrack.artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }}
                  className="hover:text-white hover:underline transition-colors"
                >
                  {a.name}
                </button>
              </span>
            ))}
            <span className="text-white/20 ml-1.5">{formatDuration(progressMs)}</span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={togglePlay}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90
              ${isPlaying ? 'bg-pink-500' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <rect x="2" y="1.5" width="3.5" height="11" rx="1.5" />
                <rect x="8.5" y="1.5" width="3.5" height="11" rx="1.5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <path d="M3 2L13 7L3 12V2Z" />
              </svg>
            )}
          </button>

          {(queue.length > 0 || contextQueue.length > 0) && (
            <button
              onClick={handleSkip}
              className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-all duration-150 active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2.5L8 7L2 11.5V2.5Z" fill="white" opacity="0.7" />
                <rect x="9" y="2.5" width="3" height="9" rx="1" fill="white" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
