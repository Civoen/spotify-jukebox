'use client'

import SpinningVinyl from './SpinningVinyl'

export const chrome = 'linear-gradient(180deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'
export const chromeH = 'linear-gradient(90deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'

/* ─── Arch crown — the glowing dome + spinning vinyl, shared by every theme ─── */
export function ArchCrown({ albumArt, isPlaying, vinylSize = 880, topPad = 0, vinylScale = 1, onVinylClick }: {
  albumArt?: string; isPlaying: boolean; vinylSize?: number; topPad?: number; vinylScale?: number; onVinylClick?: () => void
}) {
  const vR = vinylSize / 2
  const vCenterY = topPad + vR
  const archH = topPad + vR
  // Scaled vinyl dims — keep centred on same vCenterY
  const scaledVinylSize = vinylSize * vinylScale
  const scaledVR = scaledVinylSize / 2
  const vinylTop = vCenterY - scaledVR

  // Circular ring: each layer is a full circle centered on the vinyl center,
  // with radius = vinyl radius + gap. Painted large-to-small to create rings.
  const ring = (gap: number, bg: string, extra?: React.CSSProperties) => {
    const d = (vR + gap) * 2
    return {
      position: 'absolute' as const,
      width: d, height: d,
      borderRadius: '50%',
      top: vCenterY - (vR + gap),
      left: '50%',
      transform: 'translateX(-50%)',
      background: bg,
      ...extra,
    }
  }

  // A tube is the outer 6px band of its circle: colour at both edges, hot in the middle
  const tube = (color: string, core: string) =>
    `radial-gradient(circle closest-side, transparent calc(100% - 6.5px), ${color} calc(100% - 6px), ${core} calc(100% - 3px), ${color} 100%)`
  const bloom: React.CSSProperties = { mixBlendMode: 'screen', pointerEvents: 'none' }

  // Clipped along the bottom only (the arch is the top half of full circles),
  // so the neon halo can spill freely above and to the sides
  return (
    <div style={{ position: 'relative', height: archH, flexShrink: 0, clipPath: 'inset(-400px -400px 0px -400px)' }}>
      {/* Chrome outer ring */}
      <div style={ring(60, chromeH)} />
      <div style={ring(50, '#050200')} />
      {/* Pink neon tube — hot near-white core, saturated edges */}
      <div style={ring(44, tube('#ff2d78', '#ffd9e6'))} />
      <div style={ring(38, '#050200')} />
      {/* Cyan neon tube */}
      <div style={ring(32, tube('#00d4ff', '#dcf9ff'))} />
      <div style={ring(26, '#050200')} />
      {/* Inner chrome ring */}
      <div style={ring(20, chromeH, { opacity: 0.85 })} />
      <div style={ring(14, '#050200')} />
      {/* Gold accent */}
      <div style={ring(8, '#c9a227', { opacity: 0.7, boxShadow: '0 0 10px 1px rgba(240,193,74,0.35)' })} />
      {/* Dark interior */}
      <div style={ring(2, '#030100')} />

      {/* Neon bloom — light spilling off each tube onto the chrome, the dark
          channels between and the cabinet around the arch. Screen-blended so
          it only ever adds light, and breathing slowly out of step. */}
      <div style={ring(44, 'transparent', { ...bloom, boxShadow: '0 0 10px 2px #ff2d78, 0 0 30px 8px rgba(255,45,120,0.75), 0 0 80px 22px rgba(255,45,120,0.42), 0 0 170px 50px rgba(255,45,120,0.2)', animation: 'neon-breathe 2.6s ease-in-out infinite' })} />
      <div style={ring(38, 'transparent', { ...bloom, boxShadow: 'inset 0 0 8px 2px rgba(255,45,120,0.9), inset 0 0 26px 8px rgba(255,45,120,0.45)', animation: 'neon-breathe 2.6s ease-in-out infinite' })} />
      <div style={ring(32, 'transparent', { ...bloom, boxShadow: '0 0 10px 2px #00d4ff, 0 0 28px 8px rgba(0,212,255,0.6), 0 0 70px 20px rgba(0,212,255,0.28)', animation: 'neon-breathe 3s ease-in-out 1.2s infinite' })} />
      <div style={ring(26, 'transparent', { ...bloom, boxShadow: 'inset 0 0 8px 2px rgba(0,212,255,0.9), inset 0 0 30px 10px rgba(0,212,255,0.45), inset 0 0 90px 30px rgba(0,212,255,0.16)', animation: 'neon-breathe 3s ease-in-out 1.2s infinite' })} />

      {/* Vinyl */}
      <div
        onClick={onVinylClick}
        style={{ position: 'absolute', top: vinylTop, left: '50%', transform: 'translateX(-50%)', zIndex: 1, cursor: onVinylClick ? 'pointer' : 'default' }}
      >
        <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={scaledVinylSize} />
      </div>

    </div>
  )
}

/* ─── Chrome strip ─── */
export function ChromeStrip({ height = 8, opacity = 1 }: { height?: number; opacity?: number }) {
  return <div style={{ height, width: '100%', flexShrink: 0, background: chromeH, opacity }} />
}
