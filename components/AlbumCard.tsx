'use client'

import { useJukeboxStore } from '@/lib/store'
import type { SpotifyAlbum } from '@/lib/spotify'
import Art from './Art'

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
      <Art src={art} alt={album.name} className="w-32 h-32 rounded-xl mb-2 text-white" />
      <p className="text-white text-xs font-medium truncate leading-tight">{album.name}</p>
      <p className="text-white/40 text-xs truncate mt-0.5">{artist}</p>
    </button>
  )
}
