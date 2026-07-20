'use client'

import { useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { playTrack, formatDuration, getAlbumArt } from '@/lib/spotify'
import type { SpotifyTrack } from '@/lib/spotify'

interface Props {
  track: SpotifyTrack
  inQueue?: boolean
  queueId?: string
  isFirstInQueue?: boolean
}

export default function TrackRow({ track, inQueue, queueId, isFirstInQueue }: Props) {
  const {
    accessToken,
    deviceId,
    addToQueue,
    removeFromQueue,
    recentlyAdded,
    currentTrack,
    isPlaying,
    setActiveView,
    setActiveArtist,
  } = useJukeboxStore()

  const [justAdded, setJustAdded] = useState(false)
  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying
  const wasRecentlyAdded = recentlyAdded === track.id

  const art = getAlbumArt(track, 'sm')

  const moveToTop = () => {
    if (!queueId) return
    const { queue, reorderQueue } = useJukeboxStore.getState()
    const idx = queue.findIndex(t => t.queueId === queueId)
    if (idx > 0) reorderQueue(idx, 0)
  }

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const currentView = useJukeboxStore.getState().activeView
    const stayOnPage = currentView === 'search' || currentView === 'queue'
    if (inQueue && queueId) {
      // Move to front of queue so it plays next
      moveToTop()
      return
    }
    if (!currentTrack && accessToken && deviceId) {
      // Nothing playing — play immediately
      playTrack(accessToken, track.uri, deviceId)
      if (!stayOnPage) setActiveView('home')
    } else {
      // Something already playing — add to queue
      addToQueue(track)
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1500)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (queueId) removeFromQueue(queueId)
  }

  return (
    <div
      onClick={() => handleAdd()}
      className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200
        ${isCurrentlyPlaying ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5 active:bg-white/8'}
        ${wasRecentlyAdded ? 'animate-slide-up' : ''}`}
    >
      {/* Art */}
      <div className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden
        ${isCurrentlyPlaying ? 'ring-2 ring-pink-500' : ''}`}>
        {art ? (
          <img src={art} alt={track.album.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/10" />
        )}
        {isCurrentlyPlaying && (
          <div className="absolute inset-0 bg-black/50 flex items-end justify-center pb-1.5">
            <div className="flex gap-0.5 items-end h-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-0.5 bg-pink-400 rounded-full eq-bar" style={{ height: 12 }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-base font-medium truncate leading-tight
          ${isCurrentlyPlaying ? 'text-pink-300' : 'text-white'}`}>
          {track.name}
          {track.explicit && (
            <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/40 font-normal align-middle">E</span>
          )}
        </p>
        <p className="text-sm text-white/40 truncate mt-0.5">
          {track.artists.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveArtist({ id: a.id, name: a.name })
                  setActiveView('artist')
                }}
                className="hover:text-white hover:underline transition-colors"
              >
                {a.name}
              </button>
            </span>
          ))}
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs text-white/25 flex-shrink-0 mr-1">
        {formatDuration(track.duration_ms)}
      </span>

      {/* Action buttons */}
      {inQueue ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isFirstInQueue && (
            <button
              onClick={(e) => { e.stopPropagation(); moveToTop() }}
              aria-label="Move to top of queue"
              className="w-11 h-11 rounded-full flex items-center justify-center
                text-white/30 hover:text-pink-400 hover:bg-pink-400/10 transition-all duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M3 6.5L7 2.5L11 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={handleRemove}
            aria-label="Remove from queue"
            className="w-11 h-11 rounded-full flex items-center justify-center
              text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative flex-shrink-0">
          {justAdded && (
            <span
              className="absolute inset-0 rounded-full bg-pink-500 animate-ring-pulse pointer-events-none"
              aria-hidden="true"
            />
          )}
          <button
            onClick={handleAdd}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center
              transition-all duration-200 active:scale-90
              ${justAdded
                ? 'bg-pink-500 glow-pink animate-add-pop'
                : 'bg-white/8 hover:bg-white/15 text-white/60 hover:text-white'}`}
          >
            {justAdded ? (
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
          {justAdded && (
            <span
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-pink-400 animate-slide-up"
              aria-hidden="true"
            >
              Added
            </span>
          )}
        </div>
      )}
    </div>
  )
}
