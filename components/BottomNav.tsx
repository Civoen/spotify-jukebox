'use client'

import { useJukeboxStore } from '@/lib/store'

const tabs = [
  {
    id: 'home' as const,
    label: 'Now Playing',
    icon: (active: boolean, color: string) => (
      <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke={active ? color : 'currentColor'} strokeWidth="1.5" />
        <circle cx="11" cy="11" r="4" stroke={active ? color : 'currentColor'} strokeWidth="1.5" />
        <circle cx="11" cy="11" r="1.5" fill={active ? color : 'currentColor'} />
      </svg>
    ),
  },
  {
    id: 'search' as const,
    label: 'Search',
    icon: (active: boolean, color: string) => (
      <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
        <circle cx="10" cy="10" r="6.5" stroke={color} strokeWidth="1.5" />
        <path d="M15 15L19 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'queue' as const,
    label: 'Queue',
    icon: (active: boolean, color: string) => (
      <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
        <path d="M4 7H18M4 11H18M4 15H13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { activeView, setActiveView, queue, uiTheme } = useJukeboxStore()
  const isModern = uiTheme === 'modern'

  const activeTab = activeView === 'artist' ? 'search'
    : (activeView === 'album' || activeView === 'playlist') ? 'home'
    : activeView as 'home' | 'search' | 'queue'

  // Modern reuses its own amber accent (matching the Most Popular panel)
  // instead of the Standard theme's muted retro gold, so all three tabs
  // stay visually consistent with whichever design is active.
  const TAB_COLORS = {
    home: '#ff2d78',
    search: isModern ? '#ffb454' : '#c9a227',
    queue: '#00d4ff',
  } as const

  return (
    <div className="flex-shrink-0" style={{ background: isModern ? 'rgba(8,6,10,0.97)' : 'rgba(14,8,0,0.97)', transition: 'background 0.3s' }}>

      {/* Tri-colour glow diffusion — brighter on active tab */}
      <div style={{ display: 'flex', height: 14 }}>
        <div style={{ flex: 1, background: `linear-gradient(180deg, ${activeTab === 'home' ? '#ff2d78bb' : '#ff2d7830'}, transparent)`, transition: 'background 0.3s' }} />
        <div style={{ flex: 1, background: `linear-gradient(180deg, ${activeTab === 'search' ? `${TAB_COLORS.search}bb` : `${TAB_COLORS.search}30`}, transparent)`, transition: 'background 0.3s' }} />
        <div style={{ flex: 1, background: `linear-gradient(180deg, ${activeTab === 'queue' ? '#00d4ffbb' : '#00d4ff30'}, transparent)`, transition: 'background 0.3s' }} />
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-around px-4 pt-1 pb-5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          const color = TAB_COLORS[tab.id]

          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex flex-col items-center gap-1.5 py-3 px-8 rounded-2xl transition-all duration-200
                ${active ? 'opacity-100' : 'opacity-30 hover:opacity-50'}`}
              style={active ? { background: `${color}12`, boxShadow: `0 0 14px 2px ${color}22` } : {}}
            >
              <div className="relative">
                {tab.icon(active, color)}
                {tab.id === 'queue' && queue.length > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: TAB_COLORS.queue }}
                  >
                    {queue.length > 9 ? '9+' : queue.length}
                  </span>
                )}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: active ? color : 'inherit' }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
