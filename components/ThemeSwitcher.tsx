'use client'

import { useState, useRef, useEffect } from 'react'
import { useJukeboxStore } from '@/lib/store'

const THEMES = [
  { id: 'retro', label: 'Standard' },
  { id: 'modern', label: 'Modern' },
  { id: 'diner', label: 'Diner' },
] as const

export default function ThemeSwitcher({
  color = 'rgba(255,255,255,0.5)',
  menuBg = '#1a1a1a',
  accentColor = '#fff',
  border = '1px solid rgba(255,255,255,0.1)',
}: {
  color?: string
  menuBg?: string
  accentColor?: string
  border?: string
}) {
  const { uiTheme, setUiTheme } = useJukeboxStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch design"
        style={{ color, padding: 8, display: 'flex', alignItems: 'center', gap: 3 }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 8a7 7 0 0 1 12-4.5M18 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 14a7 7 0 0 1-12 4.5M4 18v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 8,
            background: menuBg, borderRadius: 14, overflow: 'hidden',
            minWidth: 160, boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            border, zIndex: 300,
          }}
        >
          {THEMES.map((t) => {
            const active = uiTheme === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setUiTheme(t.id); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '13px 18px', fontSize: 15,
                  color: active ? accentColor : 'rgba(255,255,255,0.55)',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                {t.label}
                {active && <span style={{ color: accentColor }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
