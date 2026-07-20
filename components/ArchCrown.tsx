'use client'

import SpinningVinyl from './SpinningVinyl'

export const chrome = 'linear-gradient(180deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'
export const chromeH = 'linear-gradient(90deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'

/* ─── Arch crown — the glowing dome + spinning vinyl, shared by every theme ─── */
export function ArchCrown({ albumArt, isPlaying, vinylSize = 880, topPad = 0, vinylScale = 1 }: {
  albumArt?: string; isPlaying: boolean; vinylSize?: number; topPad?: number; vinylScale?: number
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

  return (
    <div style={{ position: 'relative', height: archH, flexShrink: 0, overflow: 'hidden' }}>
      {/* Chrome outer ring */}
      <div style={ring(60, chromeH)} />
      <div style={ring(50, '#050200')} />
      {/* Pink neon */}
      <div style={ring(44, '#ff2d78', { boxShadow: '0 0 16px 5px #ff2d7866', animation: 'neon-pulse 2.5s ease-in-out 0s infinite' })} />
      <div style={ring(38, '#050200')} />
      {/* Cyan neon */}
      <div style={ring(32, '#00d4ff', { boxShadow: '0 0 14px 4px #00d4ff55', animation: 'neon-pulse 2.8s ease-in-out 1.2s infinite' })} />
      <div style={ring(26, '#050200')} />
      {/* Inner chrome ring */}
      <div style={ring(20, chromeH, { opacity: 0.85 })} />
      <div style={ring(14, '#050200')} />
      {/* Gold accent */}
      <div style={ring(8, '#c9a227', { opacity: 0.55 })} />
      {/* Dark interior */}
      <div style={ring(2, '#030100')} />

      {/* Vinyl */}
      <div style={{ position: 'absolute', top: vinylTop, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
        <SpinningVinyl albumArt={albumArt} isPlaying={isPlaying} size={scaledVinylSize} />
      </div>

    </div>
  )
}

/* ─── Chrome strip ─── */
export function ChromeStrip({ height = 8, opacity = 1 }: { height?: number; opacity?: number }) {
  return <div style={{ height, width: '100%', flexShrink: 0, background: chromeH, opacity }} />
}
