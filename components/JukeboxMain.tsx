'use client'

import { useJukeboxStore } from '@/lib/store'
import HomeView from './HomeView'
import ModernHomeView from './ModernHomeView'
import SearchView from './SearchView'
import QueueView from './QueueView'
import ArtistView from './ArtistView'
import AlbumView from './AlbumView'
import PlaylistView from './PlaylistView'
import BottomPlayer from './BottomPlayer'
import BottomNav from './BottomNav'
import SpotifyPlayer from './SpotifyPlayer'
import OnScreenKeyboard from './OnScreenKeyboard'

export default function JukeboxMain() {
  const activeView = useJukeboxStore((s) => s.activeView)
  const uiTheme = useJukeboxStore((s) => s.uiTheme)

  return (
    <div className="h-full flex flex-col retro-bg overflow-hidden">
      {/* Spotify Web Playback SDK (hidden) */}
      <SpotifyPlayer />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {activeView === 'home' && (uiTheme === 'modern' ? <ModernHomeView /> : <HomeView />)}
        {activeView === 'search' && <SearchView />}
        {activeView === 'queue' && <QueueView />}
        {activeView === 'artist' && <ArtistView />}
        {activeView === 'album' && <AlbumView />}
        {activeView === 'playlist' && <PlaylistView />}
      </div>

      {/* Bottom nav */}
      <BottomNav />

      {/* On-screen keyboard */}
      <OnScreenKeyboard />
    </div>
  )
}
