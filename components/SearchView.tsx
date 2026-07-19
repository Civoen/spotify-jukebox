'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { searchAll, getAlbumTracks, playTrack, type SpotifyArtist, type SpotifyTrack, type SpotifyAlbum } from '@/lib/spotify'
import { GENRES } from '@/lib/genres'
import TrackRow from './TrackRow'

const GENRE_LABELS = new Set(GENRES.map(g => g.label.toLowerCase()))

function toSearchQuery(q: string): string {
  const lower = q.trim().toLowerCase()
  if (GENRE_LABELS.has(lower)) return `genre:"${lower}"`
  return q
}

const RECENT_SEARCHES_KEY = 'jukebox_recent_searches'
const MAX_RECENT = 8

type Filter = 'all' | 'songs' | 'artists' | 'albums'

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]') } catch { return [] }
}
function saveRecentSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s !== q)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)))
}
function clearRecentSearches() {
  localStorage.setItem(RECENT_SEARCHES_KEY, '[]')
}

export default function SearchView() {
  const {
    accessToken,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching,
    setActiveView,
    setActiveArtist,
    setActiveAlbum,
    setKeyboardVisible,
    setOnKeyPress,
    deviceId,
    currentTrack,
    addManyToQueue,
  } = useJukeboxStore()

  const [searchError, setSearchError] = useState<string | null>(null)
  const [artistResults, setArtistResults] = useState<SpotifyArtist[]>([])
  const [albumResults, setAlbumResults] = useState<SpotifyAlbum[]>([])
  const [playingAlbumId, setPlayingAlbumId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<'recent' | 'played'>('recent')
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    setRecentSearches(getRecentSearches())
  }, [])

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim() || q.trim().length < 2 || !accessToken) {
        setSearchResults([])
        setArtistResults([])
        setAlbumResults([])
        return
      }
      setIsSearching(true)
      setSearchError(null)
      searchAll(toSearchQuery(q), accessToken)
        .then(({ tracks, artists, albums }) => {
          setSearchResults(tracks)
          setArtistResults(artists)
          setAlbumResults(albums)
          saveRecentSearch(q.trim())
          setRecentSearches(getRecentSearches())
        })
        .catch((err) => {
          const msg = String(err?.message ?? err)
          setSearchError(msg.includes('429') ? 'Too many requests — wait a bit' : msg)
        })
        .finally(() => setIsSearching(false))
    },
    [accessToken, setSearchResults, setIsSearching]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, doSearch])

  const handlePlayAllAlbum = async (album: SpotifyAlbum, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken || !deviceId || playingAlbumId) return
    setPlayingAlbumId(album.id)
    try {
      const fetched = await getAlbumTracks(album.id, accessToken)
      const tracks = fetched.map((t) => ({ ...t, album: { name: album.name, images: album.images } }))
      if (!tracks.length) return
      if (currentTrack) {
        // Song already playing — add the whole album to the priority queue,
        // in order, ahead of whatever fallback playlist is already lined up
        addManyToQueue(tracks)
      } else {
        // Nothing playing — start immediately, rest joins the priority queue
        addManyToQueue(tracks.slice(1))
        playTrack(accessToken, tracks[0].uri, deviceId)
      }
    } catch {
      // Silently ignore — album may be restricted; user can still tap in to browse it
    } finally {
      setPlayingAlbumId(null)
    }
  }

  const hasResults = searchResults.length > 0 || artistResults.length > 0 || albumResults.length > 0

  const showSongs   = filter === 'all' || filter === 'songs'
  const showArtists = filter === 'all' || filter === 'artists'
  const showAlbums  = filter === 'all' || filter === 'albums'

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',     label: 'All' },
    { id: 'songs',   label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums',  label: 'Albums' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Gold search bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-3 rounded-xl px-4 h-[72px] border-2"
          style={{ background: 'rgba(201,162,39,0.10)', borderColor: 'rgba(201,162,39,0.75)', boxShadow: '0 0 24px rgba(201,162,39,0.20), inset 0 0 12px rgba(201,162,39,0.04)' }}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" className="flex-shrink-0" style={{ color: 'rgba(201,162,39,0.6)' }}>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setOnKeyPress((key) => {
                const current = useJukeboxStore.getState().searchQuery
                if (key === 'BACKSPACE') setSearchQuery(current.slice(0, -1))
                else if (key === 'CLEAR') setSearchQuery('')
                else setSearchQuery(current + key)
              })
              setKeyboardVisible(true)
            }}
            placeholder="Search songs, artists, albums…"
            inputMode="none"
            className="flex-1 bg-transparent placeholder-white/30 text-base outline-none"
            style={{ color: 'var(--retro-cream)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1" style={{ color: 'rgba(201,162,39,0.5)' }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <button onClick={() => setActiveView('home')} className="text-white/50 text-base hover:text-white transition-colors px-2 py-3">
          Cancel
        </button>
      </div>

      {/* Filter tabs — Songs / Artists / Albums */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="flex gap-2">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95"
                style={{
                  background: active ? 'rgba(201,162,39,0.22)' : 'rgba(201,162,39,0.07)',
                  border: active ? '1px solid rgba(201,162,39,0.7)' : '1px solid rgba(201,162,39,0.2)',
                  color: active ? 'rgba(201,162,39,1)' : 'rgba(201,162,39,0.55)',
                  boxShadow: active ? '0 0 10px rgba(201,162,39,0.15)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Loading skeletons */}
        {isSearching && (
          <div className="flex flex-col gap-3 mt-2">
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
        )}

        {/* Search results */}
        {!isSearching && hasResults && (
          <div className="flex flex-col gap-1 mt-1">
            {showSongs && searchResults.length > 0 && (
              <div className="mb-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Songs</p>
                {searchResults.map((track, idx) => <TrackRow key={track.id + idx} track={track} />)}
              </div>
            )}

            {showArtists && artistResults.length > 0 && (
              <div className="mb-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Artists</p>
                <div className="flex flex-col gap-1">
                  {artistResults.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => { setActiveArtist({ id: artist.id, name: artist.name, imageUrl: artist.images?.[0]?.url }); setActiveView('artist') }}
                      className="flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-all text-left w-full"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                        {artist.images?.[0]?.url && <img src={artist.images[0].url} alt={artist.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-base font-medium truncate">{artist.name}</p>
                        <p className="text-white/40 text-sm mt-0.5">Artist</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="text-white/20 flex-shrink-0">
                        <path d="M4 3L9 7L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showAlbums && albumResults.length > 0 && (
              <div className="mb-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Albums</p>
                <div className="flex flex-col gap-1">
                  {albumResults.map((album) => (
                    <div
                      key={album.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setActiveAlbum(album); setActiveView('album') }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActiveAlbum(album); setActiveView('album') } }}
                      className="flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-all text-left w-full cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                        {album.images?.[0]?.url && <img src={album.images[0].url} alt={album.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-base font-medium truncate">{album.name}</p>
                        <p className="text-white/40 text-sm mt-0.5">{album.artists[0]?.name} · {album.release_date?.slice(0, 4)}</p>
                      </div>
                      <button
                        onClick={(e) => handlePlayAllAlbum(album, e)}
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-pink-500 hover:bg-pink-400 active:scale-90 transition-all duration-200 glow-pink"
                        aria-label={`Play all songs from ${album.name}`}
                      >
                        {playingAlbumId === album.id ? (
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="white">
                            <path d="M5 4L17 10L5 16V4Z" />
                          </svg>
                        )}
                      </button>
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="text-white/20 flex-shrink-0">
                        <path d="M4 3L9 7L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isSearching && searchError && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-xs font-mono break-all">{searchError}</p>
          </div>
        )}

        {!isSearching && !searchError && searchQuery && !hasResults && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-4xl opacity-20">🎵</div>
            <p className="text-white/40 text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}

        {/* Genre grid */}
        {!searchQuery && !isSearching && (
          <div className="mt-2 mb-4">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Browse by Genre</p>
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map(({ label, neon, neonDim }) => (
                <button
                  key={label}
                  onClick={() => setSearchQuery(label)}
                  className="active:scale-[0.97] transition-transform"
                  style={{
                    padding: '16px 8px',
                    borderRadius: 12,
                    background: `linear-gradient(180deg, rgba(20,10,2,0.98) 0%, rgba(10,5,0,1) 100%)`,
                    border: `1px solid ${neon}44`,
                    boxShadow: `inset 0 0 12px rgba(0,0,0,0.5), 0 0 8px ${neon}22`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: `linear-gradient(0deg, ${neonDim} 0%, transparent 100%)`, pointerEvents: 'none' }} />
                  <span style={{ fontSize: 16, fontWeight: 900, color: neon, textShadow: `0 0 10px ${neon}88`, fontFamily: 'var(--font-retro, monospace)' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state — recent searches */}
        {!searchQuery && !isSearching && (
          <div className="mt-1">
            <div className="flex gap-1 mb-4 glass rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setTab('recent')}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${tab === 'recent' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                Recent Searches
              </button>
              <button
                onClick={() => setTab('played')}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${tab === 'played' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                Recently Played
              </button>
            </div>

            {tab === 'recent' && (
              recentSearches.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-8">No recent searches</p>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {recentSearches.map((q) => (
                      <button
                        key={q}
                        onClick={() => setSearchQuery(q)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full glass border border-white/8 text-white/60 text-xs hover:text-white hover:border-white/20 transition-all"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50">
                          <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M7 7L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        {q}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { clearRecentSearches(); setRecentSearches([]) }}
                    className="text-white/25 text-xs hover:text-white/50 transition-colors"
                  >
                    Clear recent searches
                  </button>
                </div>
              )
            )}

            {tab === 'played' && (
              <p className="text-white/20 text-xs text-center py-8">Play some songs to see them here</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
