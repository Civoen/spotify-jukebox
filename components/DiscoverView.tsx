'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useJukeboxStore } from '@/lib/store'
import {
  getArtistTopTracks, getAlbumArt, playTrack, searchGenreSongs, formatDuration,
  type SpotifyTrack,
} from '@/lib/spotify'
import { GENRES } from '@/lib/genres'
import ErrorState, { friendlyError } from './ErrorState'

const ORANGE = '#e8823c'
const ORANGE_DARK = '#c96a28'
const OFFWHITE = '#faf6f0'
const INK = '#2a2420'
const MUTED = '#8a8078'

/** A song in the deck, plus the reason it was picked (shown on the card). */
interface Pick { track: SpotifyTrack; reason: string }
type Swipe = { poolIndex: number; track: SpotifyTrack; action: 'added' | 'played' | 'skipped' }

// The deck lives outside the component so it survives switching tabs: leaving
// Discover and coming back carries on where you left off instead of
// reshuffling and showing the same songs again.
const session = {
  picks: [] as Pick[],
  index: 0,
  ids: new Set<string>(),
  artistCursor: 0,
  genresUsed: new Set<string>(),
  history: [] as Swipe[],
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function DiscoverView() {
  const {
    accessToken, deviceId, currentTrack, queue, addToQueue, removeFromQueue,
    showToast, setActiveArtist, setActiveView,
  } = useJukeboxStore()

  const [picks, setPicks] = useState<Pick[]>(session.picks)
  const [index, setIndexState] = useState(session.index)
  const [loading, setLoading] = useState(session.picks.length === 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [canUndo, setCanUndo] = useState(session.history.length > 0)

  // Top-card gesture state
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null)
  const [returning, setReturning] = useState<'left' | 'right' | null>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const lastMove = useRef({ x: 0, t: 0, vx: 0 })
  const deckRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const setIndex = (i: number) => { session.index = i; setIndexState(i) }
  const commitPicks = (next: Pick[]) => { session.picks = next; setPicks(next) }

  // ── Building the deck ──────────────────────────────────────────────────────
  // Songs come from what this jukebox has actually played, then widen out to
  // more songs by those artists (Spotify's own recommendations API isn't open
  // to new apps). If nothing has been played yet, it starts from popular
  // genres so the page is never empty.

  /** Fetch another batch and append it. Returns how many new songs arrived. */
  // (null means a fetch was already running)
  const loadMore = useCallback(async (): Promise<number | null> => {
    if (!accessToken) return 0
    if (loadingMoreRef.current) return null // a batch is already on its way
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const { playHistory: hist, popularity: pop } = useJukeboxStore.getState()
      const artistNames = Array.from(new Set(
        [...hist, ...Object.values(pop).map(p => p.track)].flatMap(t => t.artists.map(a => a.name))
      ))
      const fresh: Pick[] = []
      const take = (tracks: SpotifyTrack[], reason: string) => {
        for (const t of tracks) {
          if (!t?.id || session.ids.has(t.id)) continue
          session.ids.add(t.id)
          fresh.push({ track: t, reason })
        }
      }

      const batch = artistNames.slice(session.artistCursor, session.artistCursor + 4)
      session.artistCursor += batch.length
      let failures = 0
      if (batch.length > 0) {
        const results = await Promise.all(
          batch.map(name => getArtistTopTracks(name, accessToken).catch(() => { failures++; return [] as SpotifyTrack[] }))
        )
        results.forEach((tracks, i) => take(tracks, `More from ${batch[i]}`))
      }

      // Out of artists (or they gave nothing new) — widen to a couple of genres
      if (fresh.length < 6) {
        const genres = shuffle(GENRES.map(g => g.label).filter(g => !session.genresUsed.has(g))).slice(0, 2)
        for (const g of genres) session.genresUsed.add(g)
        const results = await Promise.all(
          genres.map(g => searchGenreSongs(g, accessToken).catch(() => { failures++; return [] as SpotifyTrack[] }))
        )
        results.forEach((tracks, i) => take(shuffle(tracks).slice(0, 12), `Popular in ${genres[i]}`))
        if (fresh.length === 0 && failures > 0) throw new Error('Failed to fetch')
      }

      if (fresh.length > 0) commitPicks([...session.picks, ...shuffle(fresh)])
      return fresh.length
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [accessToken])

  const build = useCallback(async () => {
    if (!accessToken) { setLoading(false); return }
    setLoading(true)
    setError(null)
    setExhausted(false)
    session.picks = []; session.index = 0; session.ids = new Set(); session.artistCursor = 0
    session.genresUsed = new Set(); session.history = []
    setCanUndo(false)

    const { playHistory: hist, popularity: pop } = useJukeboxStore.getState()
    const seed: Pick[] = []
    for (const { track, count } of Object.values(pop).sort((a, b) => b.count - a.count)) {
      if (session.ids.has(track.id)) continue
      session.ids.add(track.id)
      seed.push({ track, reason: count > 1 ? `Played here ${count} times` : 'Played here before' })
    }
    for (const t of hist) {
      if (session.ids.has(t.id)) continue
      session.ids.add(t.id)
      seed.push({ track: t, reason: 'Played here recently' })
    }
    commitPicks(shuffle(seed))
    setIndex(0)
    try {
      await loadMore()
    } catch (err) {
      if (session.picks.length === 0) setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [accessToken, loadMore])

  useEffect(() => {
    if (session.picks.length === 0) build()
    // Only on first open — after that the deck is kept between visits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // ── What's on the table right now ──────────────────────────────────────────
  // Songs that are playing or already queued are passed over, so Discover
  // never offers something that's already coming up.
  const deck = useMemo(() => {
    const taken = new Set(queue.map(t => t.id))
    if (currentTrack) taken.add(currentTrack.id)
    const out: { pick: Pick; poolIndex: number }[] = []
    for (let i = index; i < picks.length; i++) {
      if (!taken.has(picks[i].track.id)) out.push({ pick: picks[i], poolIndex: i })
    }
    return out
  }, [picks, index, queue, currentTrack])

  const top = deck[0]
  const current = top?.pick.track

  // Top the deck up in the background before it runs dry
  useEffect(() => {
    if (loading || exhausted || error || deck.length > 3) return
    loadMore().then((n) => { if (n === 0) setExhausted(true) }).catch(() => setExhausted(true))
  }, [deck.length, picks.length, loading, exhausted, error, loadMore])

  // ── Swiping ────────────────────────────────────────────────────────────────
  const commitSwipe = (direction: 'right' | 'left') => {
    if (!top || exiting) return
    const { track } = top.pick
    let action: Swipe['action'] = 'skipped'
    if (direction === 'right') {
      if (!currentTrack && accessToken && deviceId) {
        playTrack(accessToken, track.uri, deviceId)
        showToast(`Now playing “${track.name}”`)
        action = 'played'
      } else {
        addToQueue(track) // shows the shared "Added to the queue" toast
        action = 'added'
      }
    }
    session.history.push({ poolIndex: top.poolIndex, track, action })
    if (session.history.length > 20) session.history.shift()
    setCanUndo(true)
    setReturning(null)
    // Let the card fly off the way it was sent, then bring up the next one
    setExiting(direction)
    const nextIndex = top.poolIndex + 1
    setTimeout(() => {
      setIndex(nextIndex)
      setDrag({ x: 0, y: 0, active: false })
      setExiting(null)
    }, 260)
  }

  const undo = () => {
    const last = session.history.pop()
    if (!last || exiting) return
    setCanUndo(session.history.length > 0)
    if (last.action === 'added') {
      const queued = [...useJukeboxStore.getState().queue].reverse().find(t => t.id === last.track.id)
      if (queued) removeFromQueue(queued.queueId)
      showToast(`Took “${last.track.name}” back out of the queue`, 'info')
    } else if (last.action === 'played') {
      showToast(`“${last.track.name}” is already playing`, 'info')
      return
    }
    setExhausted(false)
    setReturning(last.action === 'skipped' ? 'left' : 'right')
    setIndex(last.poolIndex)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (exiting) return
    // Taps on the buttons and the artist name are clicks, not the start of a drag
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY }
    lastMove.current = { x: e.clientX, t: performance.now(), vx: 0 }
    setReturning(null)
    setDrag({ x: 0, y: 0, active: true })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.active || exiting) return
    const now = performance.now()
    const dt = Math.max(1, now - lastMove.current.t)
    lastMove.current = { x: e.clientX, t: now, vx: (e.clientX - lastMove.current.x) / dt }
    // Mostly a sideways gesture — vertical movement is damped
    setDrag({ x: e.clientX - dragStart.current.x, y: (e.clientY - dragStart.current.y) * 0.35, active: true })
  }
  const onPointerUp = () => {
    if (!drag.active || exiting) return
    const threshold = (deckRef.current?.offsetWidth ?? 400) * 0.28
    const flick = Math.abs(lastMove.current.vx) > 0.55 && performance.now() - lastMove.current.t < 80
    if (drag.x > threshold || (flick && drag.x > 30 && lastMove.current.vx > 0)) commitSwipe('right')
    else if (drag.x < -threshold || (flick && drag.x < -30 && lastMove.current.vx < 0)) commitSwipe('left')
    else setDrag({ x: 0, y: 0, active: false })
  }

  const width = deckRef.current?.offsetWidth ?? 400
  const threshold = width * 0.28
  // How far through a swipe the card is (0 → 1) — drives the colour wash, the
  // stamps and the cards underneath rising up
  const progress = exiting ? 1 : Math.min(1, Math.abs(drag.x) / threshold)
  const rightAmt = exiting === 'right' ? 1 : exiting ? 0 : Math.min(1, Math.max(0, drag.x / threshold))
  const leftAmt = exiting === 'left' ? 1 : exiting ? 0 : Math.min(1, Math.max(0, -drag.x / threshold))
  const cardTransform = exiting
    ? `translate(${exiting === 'right' ? width * 1.5 : -width * 1.5}px, ${drag.y + 40}px) rotate(${exiting === 'right' ? 20 : -20}deg)`
    : `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / (width / 22)}deg)`
  const cardTransition = exiting
    ? 'transform 0.28s cubic-bezier(0.4, 0, 1, 1), opacity 0.28s ease'
    : drag.active ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1)'

  const showEnd = !loading && !error && !current && exhausted
  // Also covers the moment between running out and the next batch arriving
  const showSkeleton = loading || (!error && !current && !exhausted)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ position: 'relative', background: OFFWHITE, color: INK }}>
      {/* Ambient backdrop — a soft wash of the current artwork behind everything */}
      {current && (
        <img
          key={current.id}
          src={getAlbumArt(current, 'md')}
          alt=""
          draggable={false}
          className="discover-ambient"
          style={{ position: 'absolute', inset: '-10%', width: '120%', height: '120%', objectFit: 'cover', filter: 'blur(70px) saturate(140%)', pointerEvents: 'none' }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${OFFWHITE} 0%, rgba(250,246,240,0.72) 22%, rgba(250,246,240,0.6) 70%, ${OFFWHITE} 100%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ position: 'relative', flexShrink: 0, padding: 'clamp(24px, 4vh, 64px) clamp(20px, 5vw, 56px) clamp(12px, 2vh, 28px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 'clamp(12px, 1.9vw, 21px)', letterSpacing: '0.2em', textTransform: 'uppercase', color: ORANGE_DARK, fontWeight: 700 }}>Discover</p>
          <h1 style={{ fontSize: 'clamp(28px, 5.6vw, 62px)', fontWeight: 800, color: INK, lineHeight: 1.1, marginTop: 4, letterSpacing: '-0.02em' }}>Find your next song</h1>
          <p style={{ fontSize: 'clamp(13px, 2.4vw, 26px)', color: MUTED, marginTop: 6 }}>
            Swipe right to add it to the queue, left to pass
          </p>
        </div>
      </div>

      {/* Card deck — sized to fill the space it has, whatever the screen */}
      <div className="flex-1" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '8px clamp(20px, 6vw, 72px) 0' }}>
        <div ref={deckRef} style={{ position: 'relative', height: 'min(100%, calc((100vw - clamp(40px, 12vw, 144px)) / 0.78))', aspectRatio: '0.78', maxWidth: '100%', containerType: 'inline-size' }}>

          {showSkeleton && (
            <div className="skeleton-light" style={{ position: 'absolute', inset: 0, borderRadius: '7cqw', boxShadow: '0 20px 60px rgba(42,36,32,0.12)' }}>
              <div style={{ position: 'absolute', left: '4cqw', right: '4cqw', bottom: '4cqw', height: '24cqw', borderRadius: '5.5cqw', background: 'rgba(255,255,255,0.7)' }} />
              <p style={{ position: 'absolute', left: 0, right: 0, top: '42%', textAlign: 'center', color: MUTED, fontSize: 'clamp(14px, 4cqw, 22px)', fontWeight: 600 }}>Picking songs for you…</p>
            </div>
          )}

          {!loading && error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7cqw', background: INK }}>
              <ErrorState message={error} onRetry={build} />
            </div>
          )}

          {showEnd && (
            <div className="animate-slide-up" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '3cqw', padding: '8cqw', borderRadius: '7cqw', background: 'rgba(255,255,255,0.7)', border: '2px dashed rgba(232,130,60,0.35)' }}>
              <div style={{ width: '20cqw', height: '20cqw', borderRadius: '50%', background: 'rgba(232,130,60,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p style={{ fontSize: 'clamp(18px, 6cqw, 34px)', fontWeight: 800 }}>That&apos;s everything for now</p>
              <p style={{ fontSize: 'clamp(13px, 3.6cqw, 20px)', color: MUTED, maxWidth: '70cqw', lineHeight: 1.45 }}>
                You&apos;ve been through every pick. Go again from the top, or search for something specific.
              </p>
              <div style={{ display: 'flex', gap: '3cqw', marginTop: '2cqw', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={build} style={{ padding: '3.2cqw 6cqw', borderRadius: 999, background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_DARK})`, color: 'white', fontWeight: 700, fontSize: 'clamp(14px, 3.8cqw, 21px)', boxShadow: `0 8px 22px ${ORANGE}55` }}>
                  Shuffle again
                </button>
                <button onClick={() => setActiveView('search')} style={{ padding: '3.2cqw 6cqw', borderRadius: 999, background: 'white', border: '1px solid rgba(42,36,32,0.12)', color: INK, fontWeight: 700, fontSize: 'clamp(14px, 3.8cqw, 21px)' }}>
                  Search instead
                </button>
              </div>
            </div>
          )}

          {/* The next two cards wait underneath and rise into place as the top one leaves */}
          {!loading && !error && [2, 1].map((depth) => {
            const item = deck[depth]
            if (!item) return null
            const d = depth - progress // 2→1 and 1→0 as the top card leaves
            return (
              <div
                key={item.pick.track.id}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '7cqw', overflow: 'hidden', background: '#e9dfd0',
                  boxShadow: '0 10px 30px rgba(42,36,32,0.14)',
                  transform: `translateY(${d * 3.2}cqw) scale(${1 - d * 0.055})`,
                  transformOrigin: '50% 100%',
                  transition: drag.active ? 'none' : 'transform 0.28s ease',
                }}
              >
                <img src={getAlbumArt(item.pick.track, 'lg')} alt="" draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: OFFWHITE, opacity: Math.max(0, Math.min(0.6, d * 0.42)) }} />
              </div>
            )
          })}

          {!loading && !error && top && current && (
            <div
              key={current.id}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={returning ? `discover-return-${returning}` : ''}
              style={{
                position: 'absolute', inset: 0, borderRadius: '7cqw', overflow: 'hidden', background: '#e9dfd0',
                boxShadow: '0 24px 70px rgba(42,36,32,0.28), 0 4px 14px rgba(42,36,32,0.12)',
                transform: cardTransform,
                transition: cardTransition,
                opacity: exiting ? 0 : 1,
                cursor: drag.active ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
            >
              <img
                src={getAlbumArt(current, 'lg')}
                alt=""
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* Top wash so the chip stays legible over any artwork */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '26%', background: 'linear-gradient(180deg, rgba(0,0,0,0.34), rgba(0,0,0,0))' }} />

              {/* Why this song is here */}
              <div style={{ position: 'absolute', top: '4.5cqw', left: '4.5cqw', maxWidth: '80cqw', display: 'flex', alignItems: 'center', gap: '1.6cqw', padding: '1.8cqw 3.4cqw 1.8cqw 2.6cqw', borderRadius: 999, background: 'rgba(255,253,250,0.86)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: ORANGE_DARK, fontWeight: 700, fontSize: 'clamp(11px, 3.1cqw, 19px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ width: '1.8cqw', height: '1.8cqw', minWidth: 6, minHeight: 6, borderRadius: '50%', background: ORANGE, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{top.pick.reason}</span>
              </div>

              {/* Colour wash + stamp that build as the card is dragged */}
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(232,130,60,0) 20%, rgba(232,130,60,0.85))`, opacity: rightAmt * 0.75, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(270deg, rgba(42,36,32,0) 20%, rgba(42,36,32,0.85))`, opacity: leftAmt * 0.75, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '30%', left: '8cqw', padding: '2cqw 5cqw', borderRadius: '3cqw', border: '0.9cqw solid white', color: 'white', fontWeight: 800, fontSize: 'clamp(20px, 9cqw, 60px)', letterSpacing: '0.04em', transform: `rotate(-12deg) scale(${0.8 + rightAmt * 0.2})`, opacity: rightAmt, pointerEvents: 'none', textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>ADD</div>
              <div style={{ position: 'absolute', top: '30%', right: '8cqw', padding: '2cqw 5cqw', borderRadius: '3cqw', border: '0.9cqw solid white', color: 'white', fontWeight: 800, fontSize: 'clamp(20px, 9cqw, 60px)', letterSpacing: '0.04em', transform: `rotate(12deg) scale(${0.8 + leftAmt * 0.2})`, opacity: leftAmt, pointerEvents: 'none', textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>PASS</div>

              {/* Frosted glass panel — title, artist and the two actions */}
              <div style={{
                position: 'absolute', left: '4cqw', right: '4cqw', bottom: '4cqw',
                borderRadius: '5.5cqw',
                backdropFilter: 'blur(22px) saturate(160%)', WebkitBackdropFilter: 'blur(22px) saturate(160%)',
                background: 'rgba(255,253,250,0.78)',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                padding: '4cqw 4cqw 4cqw 5cqw',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqw',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 'clamp(18px, 5.6cqw, 40px)', fontWeight: 800, color: INK, lineHeight: 1.15, letterSpacing: '-0.01em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {current.name}
                  </p>
                  <button
                    onClick={() => { const a = current.artists[0]; if (a) { setActiveArtist({ id: a.id, name: a.name }); setActiveView('artist') } }}
                    style={{ display: 'block', maxWidth: '100%', fontSize: 'clamp(13px, 3.8cqw, 26px)', color: ORANGE_DARK, fontWeight: 700, marginTop: '0.8cqw', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'left' }}
                  >
                    {current.artists.map(a => a.name).join(', ')}
                  </button>
                  <p style={{ fontSize: 'clamp(11px, 2.9cqw, 19px)', color: MUTED, marginTop: '0.8cqw', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {current.album?.name ? `${current.album.name} · ` : ''}{formatDuration(current.duration_ms)}
                    {current.explicit && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(42,36,32,0.1)', fontSize: '0.8em', fontWeight: 700 }}>E</span>}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2.6cqw', flexShrink: 0 }}>
                  <button onClick={() => commitSwipe('left')} aria-label="Pass on this song"
                    style={{ width: '14cqw', height: '14cqw', minWidth: 48, minHeight: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(42,36,32,0.08)', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
                    <svg width="38%" height="38%" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                  <button onClick={() => commitSwipe('right')} aria-label="Add this song to the queue"
                    style={{ width: '17cqw', height: '17cqw', minWidth: 56, minHeight: 56, borderRadius: '50%', background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_DARK})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${ORANGE}77` }}>
                    <svg width="42%" height="42%" viewBox="0 0 14 14" fill="none"><path d="M7 2V12M2 7H12" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer — undo on the left, how many are left on the right. The middle
          is kept clear because that is where the shared toast appears. */}
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'clamp(14px, 2.4vh, 36px) clamp(20px, 6vw, 72px) clamp(18px, 3vh, 44px)', minHeight: 'clamp(76px, 9vh, 130px)' }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 'clamp(10px, 1.4vh, 18px) clamp(18px, 3vw, 34px)', borderRadius: 999,
            background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(42,36,32,0.1)', color: INK,
            fontSize: 'clamp(14px, 2.3vw, 25px)', fontWeight: 700,
            boxShadow: canUndo ? '0 6px 18px rgba(42,36,32,0.1)' : 'none',
            opacity: canUndo ? 1 : 0.4,
          }}
        >
          <svg width="1.1em" height="1.1em" viewBox="0 0 16 16" fill="none"><path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6M3 6.5l3-3M3 6.5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Undo
        </button>
        {current && (
          <div style={{ fontSize: 'clamp(13px, 2.1vw, 23px)', fontWeight: 700, color: MUTED, whiteSpace: 'nowrap' }}>
            {deck.length}{exhausted ? '' : '+'} to go
          </div>
        )}
      </div>
    </div>
  )
}
