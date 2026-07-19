'use client'

import { useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { formatDuration } from '@/lib/spotify'
import { globalPlayer } from './SpotifyPlayer'

export default function NowPlayingHero() {
  const { currentTrack, isPlaying, progressMs, durationMs, setIsPlaying, setActiveView, setActiveArtist } = useJukeboxStore()
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)

  const displayMs = scrubbing ? scrubValue : progressMs
  const progress = durationMs > 0 ? (displayMs / durationMs) * 100 : 0
  const art = currentTrack?.album.images?.[0]?.url

  const handleScrubStart = () => {
    setScrubbing(true)
    setScrubValue(progressMs)
  }

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(Number(e.target.value))
  }

  const handleScrubEnd = () => {
    globalPlayer?.seek(scrubValue)
    useJukeboxStore.setState({ progressMs: scrubValue })
    setScrubbing(false)
  }

  const togglePlay = () => {
    if (isPlaying) {
      globalPlayer?.pause()
    } else {
      globalPlayer?.resume()
    }
    setIsPlaying(!isPlaying)
  }

  if (!currentTrack) {
    return (
      <div className="mx-4 mt-4 mb-2 rounded-3xl overflow-hidden glass border border-white/5 p-6 flex flex-col items-center gap-3">
        {/* Idle jukebox display */}
        <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center animate-float">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" opacity="0.4">
            <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="8" stroke="white" strokeWidth="1" />
            <circle cx="24" cy="24" r="3" fill="white" opacity="0.5" />
            <line x1="36" y1="12" x2="28" y2="20" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="36" cy="12" r="2" fill="#00d4ff" opacity="0.6" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white/60 text-sm font-medium">Your jukebox is waiting…</p>
          <p className="text-white/25 text-xs mt-1">Search for a song to get started</p>
        </div>

      </div>
    )
  }

  return (
    <div
      className="mx-4 mt-4 mb-2 rounded-3xl overflow-hidden relative"
      style={{
        background: art
          ? `linear-gradient(180deg, rgba(10,10,15,0.3) 0%, rgba(10,10,15,0.95) 100%)`
          : 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Album art background blur */}
      {art && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${art})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) saturate(1.5)',
            transform: 'scale(1.2)',
            opacity: 0.4,
          }}
        />
      )}

      <div className="relative p-5 flex flex-col gap-4">
        {/* Album art + info */}
        <div className="flex items-center gap-4">
          {art ? (
            <div className={`flex-shrink-0 ${isPlaying ? 'glow-pink' : ''} transition-all duration-500`}>
              <img
                src={art}
                alt={currentTrack.album.name}
                className="w-20 h-20 rounded-xl object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl bg-white/10 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {/* Equalizer bars when playing */}
            {isPlaying && (
              <div className="flex gap-0.5 mb-2 h-3 items-end">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-1 bg-pink-400 rounded-full eq-bar" style={{ height: 12 }} />
                ))}
              </div>
            )}
            <p className="text-white font-bold text-base leading-tight truncate">
              {currentTrack.name}
            </p>
            <p className="text-white/50 text-sm truncate">
              {currentTrack.artists.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ', '}
                  <button
                    onClick={() => { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') }}
                    className="hover:text-white hover:underline transition-colors"
                  >
                    {a.name}
                  </button>
                </span>
              ))}
            </p>
            <p className="text-white/25 text-xs truncate mt-0.5">
              {currentTrack.album.name}
            </p>
          </div>

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
              transition-all duration-200 active:scale-90
              ${isPlaying ? 'bg-pink-500 glow-pink' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <rect x="3" y="2" width="4" height="14" rx="1.5" />
                <rect x="11" y="2" width="4" height="14" rx="1.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <path d="M4 3L16 9L4 15V3Z" />
              </svg>
            )}
          </button>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={durationMs || 1}
            value={displayMs}
            onMouseDown={handleScrubStart}
            onTouchStart={handleScrubStart}
            onChange={handleScrubChange}
            onMouseUp={handleScrubEnd}
            onTouchEnd={handleScrubEnd}
            className="w-full scrubber-gold"
            style={{
              background: `linear-gradient(to right, #c9a227 ${progress}%, rgba(201,162,39,0.15) ${progress}%)`,
            }}
          />
          <div className="flex justify-between">
            <span className="text-xs text-white/30">{formatDuration(displayMs)}</span>
            <span className="text-xs text-white/30">{formatDuration(durationMs)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
