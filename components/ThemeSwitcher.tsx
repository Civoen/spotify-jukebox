'use client'

import { useJukeboxStore } from '@/lib/store'

export default function ThemeSwitcher({ color = 'rgba(255,255,255,0.5)' }: { color?: string }) {
  const { uiTheme, setUiTheme } = useJukeboxStore()

  return (
    <button
      onClick={() => setUiTheme(uiTheme === 'modern' ? 'retro' : 'modern')}
      aria-label={`Switch to ${uiTheme === 'modern' ? 'Standard' : 'Modern'} design`}
      style={{ color, padding: 8 }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 8a7 7 0 0 1 12-4.5M18 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 14a7 7 0 0 1-12 4.5M4 18v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
