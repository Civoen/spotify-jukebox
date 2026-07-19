'use client'

import { useEffect, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { getArtistTopTracks, getArtistAlbums, getAlbumTracks, type SpotifyTrack, type SpotifyAlbum } from '@/lib/spotify'
import TrackRow from './TrackRow'

function AlbumCard({ album, token }: { album: SpotifyAlbum; token: string }) {
  const [expanded, setExpanded] = useState(false)
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(false)

  const toggle = () => {
    if (!expanded && tracks.length === 0) {
      setLoading(true)
      getAlbumTracks(album.id, token)
        .then((fetched) => setTracks(fetched.map((t) => ({ ...t, album: { name: album.name, images: album.images } }))))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
    setExpanded((v) => !v)
  }

  const art = album.images?.[0]?.url

  return (
    <div className="rounded-2xl overflow-hidden glass border border-white/5">
      <button onClick={toggle} className="flex items-center gap-3 p-3 w-full text-left hover:bg-white/5 transition-colors">
        {art ? (
          <img src={art} alt={album.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/10 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{album.name}</p>
          <p className="text-white/40 text-xs mt-0.5">
            {album.release_date?.slice(0, 4)} · {album.total_tracks} tracks
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`text-white/30 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-2 pb-2">
          {loading ? (
            <div className="flex flex-col gap-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded-lg skeleton flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-32 rounded skeleton mb-1.5" />
                    <div className="h-2.5 w-20 rounded skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pt-1">
              {tracks.map((track) => (
                <TrackRow key={track.id} track={track} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ArtistView() {
  const { activeArtist, accessToken, setActiveView } = useJukeboxStore()
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeArtist || !accessToken) return
    setLoading(true)
    setError(null)
    Promise.all([
      getArtistTopTracks(activeArtist.name, accessToken),
      getArtistAlbums(activeArtist.name, accessToken),
    ])
      .then(([t, a]) => {
        setTracks(t)
        setAlbums(a)
      })
      .catch((err) => {
        console.error(err)
        setError(String(err?.message ?? err))
      })
      .finally(() => setLoading(false))
  }, [activeArtist, accessToken])

  if (!activeArtist) return null

  return (
    <div className="h-full flex flex-col">
      {/* Artist header */}
      <div className="flex-shrink-0 relative">
        <div
          className="h-44 relative flex items-end"
          style={{
            background: activeArtist.imageUrl
              ? `linear-gradient(to bottom, rgba(10,10,15,0.2), rgba(10,10,15,0.95)), url(${activeArtist.imageUrl}) center/cover`
              : 'linear-gradient(135deg, #1a0a2e, #0a0a0f)',
          }}
        >
          <button
            onClick={() => setActiveView('search')}
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2.5 rounded-full glass text-white/80 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.15)', fontSize: 15, fontWeight: 600 }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <div className="px-4 pb-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Artist</p>
            <h1 className="text-white font-bold text-2xl leading-tight">{activeArtist.name}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
            <p className="text-red-400 text-xs font-mono break-all">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
          <>
            {/* Popular songs */}
            {tracks.length > 0 && (
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-white/40 text-xs uppercase tracking-widest">Popular</p>
                  <p className="text-white/25 text-xs">{tracks.length} songs</p>
                </div>
                <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 420 }}>
                  {tracks.map((track) => (
                    <TrackRow key={track.id} track={track} />
                  ))}
                </div>
              </div>
            )}

            {/* Albums */}
            {albums.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Albums & Singles</p>
                <div className="flex flex-col gap-2">
                  {albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      token={accessToken!}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
