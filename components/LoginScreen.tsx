'use client'

import { useEffect, useState } from 'react'
import { initiateLogin } from '@/lib/spotify'

export default function LoginScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'access_denied') {
      setErrorMsg("Your Spotify account isn't authorised for this jukebox yet. Ask the venue owner to add you in the Spotify dashboard.")
    } else if (err) {
      setErrorMsg('Login failed — please try again.')
    }
  }, [])

  return (
    <div className="h-full flex flex-col items-center justify-center bg-jukebox px-6">
      {/* Decorative rings */}
      <div className="relative flex items-center justify-center mb-10">
        <div className="absolute w-64 h-64 rounded-full border border-white/5" />
        <div className="absolute w-48 h-48 rounded-full border border-white/5" />
        <div className="absolute w-32 h-32 rounded-full border border-pink-500/20 animate-pulse-glow" />

        {/* Jukebox icon */}
        <div className="relative z-10 w-24 h-24 rounded-3xl glass glow-pink flex items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            {/* Record */}
            <circle cx="24" cy="24" r="18" stroke="rgba(255,45,120,0.6)" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="12" stroke="rgba(255,45,120,0.4)" strokeWidth="1" />
            <circle cx="24" cy="24" r="6" fill="rgba(255,45,120,0.3)" stroke="rgba(255,45,120,0.6)" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="2" fill="#ff2d78" />
            {/* Needle arm */}
            <line x1="36" y1="12" x2="28" y2="20" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="36" cy="12" r="2" fill="#00d4ff" />
          </svg>
        </div>
      </div>

      <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
        Jukebox
      </h1>
      <p className="text-white/40 text-sm text-center mb-10 max-w-xs">
        Your personal retro-modern jukebox,<br />powered by Spotify
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {['Search millions of songs', 'Queue & skip', 'Real-time playback'].map((f) => (
          <span
            key={f}
            className="text-xs px-3 py-1 rounded-full glass text-white/50"
          >
            {f}
          </span>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-6 px-4 py-3 rounded-xl text-center text-sm max-w-xs"
          style={{ background: 'rgba(255,45,120,0.12)', border: '1px solid rgba(255,45,120,0.3)', color: 'rgba(255,255,255,0.75)' }}>
          {errorMsg}
        </div>
      )}

      <button
        onClick={() => initiateLogin()}
        className="flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold text-white text-base
          bg-[#1DB954] hover:bg-[#1ed760] active:scale-95
          transition-all duration-150 shadow-lg shadow-[#1DB954]/30"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        Connect with Spotify
      </button>

      <p className="mt-6 text-white/20 text-xs text-center max-w-xs">
        Requires a Spotify account. Premium needed for full playback.
      </p>
    </div>
  )
}
