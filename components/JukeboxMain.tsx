'use client'

import { AnimatePresence, motion } from 'framer-motion'
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
    <div className={`h-full flex flex-col overflow-hidden ${uiTheme === 'modern' ? 'modern-bg' : 'retro-bg'}`} style={{ transition: 'background 0.4s ease' }}>
      {/* Spotify Web Playback SDK (hidden) */}
      <SpotifyPlayer />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Home view crossfades between Standard and Modern when Switch Design is clicked */}
        <AnimatePresence mode="wait">
          {activeView === 'home' && (
            <motion.div
              key={uiTheme}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              {uiTheme === 'modern' ? <ModernHomeView /> : <HomeView />}
            </motion.div>
          )}
        </AnimatePresence>
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
