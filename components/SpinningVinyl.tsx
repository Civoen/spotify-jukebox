'use client'

interface Props {
  albumArt?: string
  isPlaying: boolean
  size?: number
  tilt?: boolean // shows the disc on a 3D skew, like it's viewed at an angle inside the machine
}

export default function SpinningVinyl({ albumArt, isPlaying, size = 220, tilt = false }: Props) {
  const r = size / 2
  const labelSize = size * 0.38

  const disc = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer vinyl disc */}
      <circle cx={r} cy={r} r={r - 2} fill="#111" stroke="#2a2010" strokeWidth="2" />

      {/* Groove rings */}
      {[0.48, 0.44, 0.40, 0.36, 0.32, 0.28, 0.26].map((ratio, i) => (
        <circle
          key={i}
          cx={r} cy={r} r={r * ratio * 2}
          fill="none"
          stroke="rgba(201,162,39,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* Sheen */}
      <ellipse cx={r * 0.7} cy={r * 0.6} rx={r * 0.25} ry={r * 0.08}
        fill="rgba(255,255,255,0.04)" transform={`rotate(-35 ${r} ${r})`} />

      {/* Center label */}
      <circle cx={r} cy={r} r={labelSize / 2} fill={albumArt ? 'transparent' : '#8B0000'} />

      {albumArt && (
        <>
          <defs>
            <clipPath id="label-clip">
              <circle cx={r} cy={r} r={labelSize / 2} />
            </clipPath>
          </defs>
          <image
            href={albumArt}
            x={r - labelSize / 2}
            y={r - labelSize / 2}
            width={labelSize}
            height={labelSize}
            clipPath="url(#label-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          {/* Label overlay tint */}
          <circle cx={r} cy={r} r={labelSize / 2} fill="rgba(0,0,0,0.25)" />
        </>
      )}

      {/* Label ring */}
      <circle cx={r} cy={r} r={labelSize / 2}
        fill="none" stroke="rgba(201,162,39,0.5)" strokeWidth="1.5" />

      {/* Spindle hole */}
      <circle cx={r} cy={r} r={size * 0.025} fill="#0e0800" stroke="#c9a227" strokeWidth="1" />
    </svg>
  )

  if (!tilt) {
    return (
      <div
        className={isPlaying ? 'vinyl-playing' : 'vinyl-paused'}
        style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
      >
        {disc}
      </div>
    )
  }

  // Tilted version — an outer wrapper establishes the 3D viewing depth
  // (perspective) and holds the static backward tilt (rotateX). The spin
  // animation lives on an inner element within that same 3D space
  // (transform-style: preserve-3d), so it visibly rotates around the
  // now-tilted disc's own face — like looking down into a real turntable —
  // rather than just spinning flat and looking the same as an untilted disc.
  return (
    <div style={{ width: size, height: size * 0.62, position: 'relative', flexShrink: 0, perspective: 900 }}>
      <div
        style={{
          width: size, height: size, position: 'absolute', left: 0, top: -(size - size * 0.62) / 2,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(58deg)',
        }}
      >
        <div
          className={isPlaying ? 'vinyl-playing' : 'vinyl-paused'}
          style={{ width: size, height: size }}
        >
          {disc}
        </div>
      </div>
    </div>
  )
}
