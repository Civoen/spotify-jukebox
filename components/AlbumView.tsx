'use client'

import { useEffect, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { getAlbumTracks, playTrack, type SpotifyTrack } from '@/lib/spotify'
import TrackRow from './TrackRow'

export default function AlbumView() {
  const { activeAlbum, accessToken, deviceId, currentTrack, setActiveView, setContextQueue } = useJukeboxStore()
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAlbum || !accessToken) return
    setLoading(true)
    setError(null)
    getAlbumTracks(activeAlbum.id, accessToken)
      .then((fetched) =>
        setTracks(fetched.map((t) => ({ ...t, album: { name: activeAlbum.name, images: activeAlbum.images } })))
      )
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false))
  }, [activeAlbum, accessToken])

  const handlePlayAll = () => {
    if (!tracks.length || !accessToken || !deviceId) return
    if (currentTrack) {
      // Song already playing — this album becomes the new fallback playlist,
      // picking up right after any user-queued songs finish
      setContextQueue(tracks)
    } else {
      // Nothing playing — start immediately, rest becomes the fallback playlist
      setContextQueue(tracks.slice(1))
      playTrack(accessToken, tracks[0].uri, deviceId)
    }
  }

  if (!activeAlbum) return null

  const art = activeAlbum.images?.[0]?.url
  const artist = activeAlbum.artists[0]?.name

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 relative">
        <div
          className="h-52 relative flex items-end"
          style={{
            background: art
              ? `linear-gradient(to bottom, rgba(10,10,15,0.1), rgba(10,10,15,0.95)), url(${art}) center/cover`
              : 'linear-gradient(135deg, #1a0a2e, #0a0a0f)',
          }}
        >
          <button
            onClick={() => setActiveView('home')}
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2.5 rounded-full glass text-white/80 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.15)', fontSize: 15, fontWeight: 600 }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <div className="px-4 pb-4 flex items-end gap-4 w-full">
            {art && <img src={art} alt={activeAlbum.name} className="w-20 h-20 rounded-xl object-cover shadow-lg flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Album</p>
              <h1 className="text-white font-bold text-xl leading-tight truncate">{activeAlbum.name}</h1>
              <p className="text-white/50 text-sm mt-0.5">{artist} · {activeAlbum.release_date?.slice(0, 4)}</p>
            </div>
            {!loading && tracks.length > 0 && (
              <button
                onClick={handlePlayAll}
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-pink-500 hover:bg-pink-400 active:scale-90 transition-all duration-200 glow-pink"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                  <path d="M5 4L17 10L5 16V4Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
            <p className="text-red-400 text-xs font-mono break-all">{error}</p>
          </div>
        )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-12 h-12 rounded-lg skeleton flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 w-36 rounded skeleton mb-2" />
                  <div className="h-3 w-24 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {tracks.map((track, i) => (
              <div key={track.id} className="flex items-center gap-2">
                <span className="text-white/20 text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                <div className="flex-1"><TrackRow track={track} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
