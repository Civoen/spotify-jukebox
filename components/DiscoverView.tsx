'use client'

import { useEffect, useRef, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { getArtistTopTracks, getAlbumArt, playTrack, type SpotifyTrack } from '@/lib/spotify'

const ORANGE = '#e8823c'
const ORANGE_DARK = '#c96a28'
const OFFWHITE = '#faf6f0'
const INK = '#2a2420'
const MUTED = '#8a8078'

const SWIPE_THRESHOLD = 110

export default function DiscoverView() {
  const {
    accessToken, deviceId, currentTrack, addToQueue,
    playHistory, popularity, setActiveView,
  } = useJukeboxStore()

  const [pool, setPool] = useState<SpotifyTrack[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastAction, setLastAction] = useState<'added' | 'skipped' | null>(null)

  // Drag state for the top card
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const dragStart = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Build the discovery pool: songs already played here, plus more songs by
  // artists the venue has already played (the closest "similar" signal
  // available without Spotify's recommendations API, which isn't open to
  // new apps).
  useEffect(() => {
    if (!accessToken) { setLoading(false); return }
    let cancelled = false

    const build = async () => {
      setLoading(true)
      const seen = new Set<string>()
      const combined: SpotifyTrack[] = []

      for (const t of playHistory) {
        if (!seen.has(t.id)) { seen.add(t.id); combined.push(t) }
      }
      for (const { track } of Object.values(popularity)) {
        if (!seen.has(track.id)) { seen.add(track.id); combined.push(track) }
      }

      // Expand with more songs by artists already played
      const artistNames = Array.from(new Set(
        [...playHistory, ...Object.values(popularity).map(p => p.track)]
          .flatMap(t => t.artists.map(a => a.name))
      )).slice(0, 6)

      const expansions = await Promise.all(
        artistNames.map(name => getArtistTopTracks(name, accessToken).catch(() => []))
      )
      for (const tracks of expansions) {
        for (const t of tracks) {
          if (!seen.has(t.id)) { seen.add(t.id); combined.push(t) }
        }
      }

      // Shuffle
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]]
      }

      if (!cancelled) { setPool(combined); setLoading(false) }
    }

    build()
    return () => { cancelled = true }
  }, [accessToken])

  const current = pool[index]
  const next = pool[index + 1]

  const commitSwipe = (direction: 'right' | 'left') => {
    if (!current) return
    if (direction === 'right') {
      if (!currentTrack && accessToken && deviceId) playTrack(accessToken, current.uri, deviceId)
      else addToQueue(current)
      setLastAction('added')
    } else {
      setLastAction('skipped')
    }
    setTimeout(() => setLastAction(null), 900)
    setDrag({ x: 0, y: 0, active: false })
    setIndex(i => i + 1)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY }
    setDrag({ x: 0, y: 0, active: true })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.active) return
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y, active: true })
  }
  const onPointerUp = () => {
    if (!drag.active) return
    if (drag.x > SWIPE_THRESHOLD) commitSwipe('right')
    else if (drag.x < -SWIPE_THRESHOLD) commitSwipe('left')
    else setDrag({ x: 0, y: 0, active: false })
  }

  const rotation = drag.x / 18
  const rightOpacity = Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD))
  const leftOpacity = Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD))

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: OFFWHITE, color: INK }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '48px 20px 18px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED, fontWeight: 700 }}>Discover</p>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: INK, marginTop: 6 }}>Find your next song</h1>
        <p style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>
          Songs you&apos;ve played here, and more like them
        </p>
      </div>

      {/* Card stack */}
      <div className="flex-1" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '0 24px' }}>
        {loading && (
          <p style={{ color: MUTED, fontSize: 15 }}>Finding songs…</p>
        )}

        {!loading && !current && (
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(232,130,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-9.5-9C.5 7.5 3 3 7 3c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.5 4.5 4.5 9-2.5 4.65-9.5 9-9.5 9z" stroke={ORANGE} strokeWidth="1.5" /></svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              {pool.length === 0 ? "Nothing to discover yet" : "You've been through them all"}
            </p>
            <p style={{ fontSize: 14, color: MUTED }}>
              {pool.length === 0
                ? 'Play a few songs on the jukebox first — Discover builds its picks from what gets played here.'
                : 'Check back after a few more songs have played for a fresh batch.'}
            </p>
          </div>
        )}

        {!loading && next && (
          <div style={{
            position: 'absolute', width: 'min(92vw, 460px)', aspectRatio: '0.8',
            borderRadius: 32, background: 'white', boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            transform: 'scale(0.94) translateY(14px)', opacity: 0.6,
          }} />
        )}

        {!loading && current && (
          <div
            ref={cardRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              position: 'relative', width: 'min(92vw, 460px)', aspectRatio: '0.8',
              borderRadius: 32, background: 'white', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
              transition: drag.active ? 'none' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              cursor: drag.active ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <img
              src={getAlbumArt(current, 'lg')}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '66%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '26px 28px', height: '34%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderTop: '1px solid #f0ebe2' }}>
              <p style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%' }}>{current.name}</p>
              <p style={{ fontSize: 17, color: ORANGE, fontWeight: 600, marginTop: 8, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%' }}>{current.artists.map(a => a.name).join(', ')}</p>
            </div>

            {/* Swipe direction indicators */}
            <div style={{ position: 'absolute', top: 24, left: 24, padding: '6px 16px', borderRadius: 999, border: `3px solid #d64545`, color: '#d64545', fontWeight: 800, fontSize: 15, letterSpacing: '0.05em', transform: 'rotate(-12deg)', opacity: leftOpacity }}>SKIP</div>
            <div style={{ position: 'absolute', top: 24, right: 24, padding: '6px 16px', borderRadius: 999, border: `3px solid ${ORANGE}`, color: ORANGE, fontWeight: 800, fontSize: 15, letterSpacing: '0.05em', transform: 'rotate(12deg)', opacity: rightOpacity }}>ADD</div>
          </div>
        )}

        {/* Confirmation toast */}
        {lastAction && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: lastAction === 'added' ? ORANGE : '#c9c2b8', color: 'white',
            padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 700,
          }}>
            {lastAction === 'added' ? 'Added to queue' : 'Skipped'}
          </div>
        )}
      </div>

      {/* Action buttons — pulled up to sit right against the card's bottom edge */}
      {!loading && current && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, marginTop: -38, padding: '0 0 30px', position: 'relative', zIndex: 5 }}>
          <button onClick={() => commitSwipe('left')} className="active:scale-90 transition-transform"
            style={{ width: 74, height: 74, borderRadius: '50%', background: 'white', border: '2px solid #e8e2d8', color: '#d64545', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <button onClick={() => commitSwipe('right')} className="active:scale-90 transition-transform"
            style={{ width: 88, height: 88, borderRadius: '50%', background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_DARK})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 26px ${ORANGE}66` }}>
            <svg width="34" height="34" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
