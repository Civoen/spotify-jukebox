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
import FullscreenPlayer from './FullscreenPlayer'

export default function JukeboxMain() {
  const activeView = useJukeboxStore((s) => s.activeView)
  const uiTheme = useJukeboxStore((s) => s.uiTheme)
  const fullscreenOpen = useJukeboxStore((s) => s.fullscreenOpen)

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
              initial={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
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

      {/* Fullscreen Now Playing — opened by tapping the vinyl / album art */}
      <AnimatePresence>
        {fullscreenOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <FullscreenPlayer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
