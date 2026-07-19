'use client'

import { useEffect, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { getPlaylistTracks, searchTracks, playTrack, type SpotifyTrack } from '@/lib/spotify'
import TrackRow from './TrackRow'

export default function PlaylistView() {
  const { activePlaylist, accessToken, deviceId, currentTrack, setActiveView, addManyToQueue } = useJukeboxStore()
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activePlaylist || !accessToken) return
    setLoading(true)
    setError(null)
    getPlaylistTracks(activePlaylist.id, accessToken)
      .then((t) => { if (t.length > 0) setTracks(t); else throw new Error('empty') })
      .catch(() =>
        // Fallback: search for tracks using playlist name as query
        searchTracks(activePlaylist.name, accessToken)
          .then((t) => { setTracks(t); setError('fallback') })
          .catch(() => setError('restricted'))
      )
      .finally(() => setLoading(false))
  }, [activePlaylist, accessToken])

  const handlePlayAll = () => {
    if (!tracks.length || !accessToken || !deviceId) return
    if (currentTrack) {
      // Song already playing — add the whole playlist to the priority queue,
      // in order, ahead of whatever fallback playlist is already lined up
      addManyToQueue(tracks)
    } else {
      // Nothing playing — start immediately, rest joins the priority queue
      addManyToQueue(tracks.slice(1))
      playTrack(accessToken, tracks[0].uri, deviceId)
    }
  }

  if (!activePlaylist) return null

  const art = activePlaylist.images?.[0]?.url

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 relative">
        <div
          className="h-52 relative flex items-end"
          style={{
            background: art
              ? `linear-gradient(to bottom, rgba(10,10,15,0.1), rgba(10,10,15,0.95)), url(${art}) center/cover`
              : 'linear-gradient(135deg, #0a1a2e, #0a0a0f)',
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
            {art && <img src={art} alt={activePlaylist.name} className="w-20 h-20 rounded-xl object-cover shadow-lg flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Playlist</p>
              <h1 className="text-white font-bold text-xl leading-tight truncate">{activePlaylist.name}</h1>
              <p className="text-white/50 text-sm mt-0.5">{activePlaylist.owner?.display_name} · {activePlaylist.tracks?.total} songs</p>
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
        {error === 'fallback' && (
          <p className="text-white/25 text-xs text-center py-2 mb-1">
            Showing similar tracks — playlist requires Spotify Extended Access
          </p>
        )}
        {error === 'restricted' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4">
            <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity="0.4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 11c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z" fill="white"/>
              </svg>
            </div>
            <div>
              <p className="text-white/60 text-sm font-medium">Playlist access restricted</p>
              <p className="text-white/30 text-xs mt-1 leading-relaxed">
                Your Spotify app needs Extended API access to load playlist tracks.
                Apply in the Spotify Developer Dashboard under your app settings.
              </p>
            </div>
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
            {tracks.map((track) => (
              <TrackRow key={track.id} track={track} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
