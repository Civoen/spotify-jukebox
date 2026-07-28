'use client'

import { useJukeboxStore } from '@/lib/store'

export default function PlayerDisconnectedBanner() {
  const playerDisconnected = useJukeboxStore((s) => s.playerDisconnected)

  if (!playerDisconnected) return null

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        background: 'linear-gradient(90deg, #7a1a1a, #a02020)',
        color: 'white',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600 }}>
        Playback disconnected — the jukebox lost its connection to Spotify.
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'white', color: '#7a1a1a', fontWeight: 700, fontSize: 14,
          padding: '6px 18px', borderRadius: 20, flexShrink: 0,
        }}
      >
        Reconnect
      </button>
    </div>
  )
}
