'use client'

import { useState } from 'react'

// Album / artist artwork that fades in once loaded and falls back to a
// record placeholder if the image is missing or fails to load — so a slow or
// broken image never shows as a blank box or a broken-image icon.
export default function Art({ src, alt = '', className = '', style }: { src?: string | null; alt?: string; className?: string; style?: React.CSSProperties }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const show = !!src && !failed

  return (
    <span className={className} style={{ position: 'relative', display: 'block', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', ...style }}>
      {(!show || !loaded) && (
        <span className={show ? 'skeleton' : ''} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!show && (
            <svg width="45%" height="45%" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.22 }}>
              <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </span>
      )}
      {show && (
        <img
          src={src!}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true) }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
      )}
    </span>
  )
}
