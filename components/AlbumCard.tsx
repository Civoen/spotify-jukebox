'use client'

import { useJukeboxStore } from '@/lib/store'
import type { SpotifyAlbum } from '@/lib/spotify'

interface Props {
  album: SpotifyAlbum
}

export default function AlbumCard({ album }: Props) {
  const { setActiveView, setActiveAlbum } = useJukeboxStore()

  const art = album.images?.[0]?.url
  const artist = album.artists[0]?.name || 'Unknown'

  return (
    <button
      onClick={() => { setActiveAlbum(album); setActiveView('album') }}
      className="flex-shrink-0 w-32 text-left active:scale-95 transition-transform duration-150"
    >
      <div className="w-32 h-32 rounded-xl overflow-hidden mb-2 bg-white/5">
        {art ? (
          <img src={art} alt={album.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-purple-500/20" />
        )}
      </div>
      <p className="text-white text-xs font-medium truncate leading-tight">{album.name}</p>
      <p className="text-white/40 text-xs truncate mt-0.5">{artist}</p>
    </button>
  )
}
