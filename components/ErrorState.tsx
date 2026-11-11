'use client'

// Friendly "couldn't load" panel with a retry button — used anywhere a
// Spotify request can fail, instead of showing the raw API error text.
export function friendlyError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '')
  if (msg.includes('429')) return 'Spotify is a bit busy right now. Give it a few seconds and try again.'
  if (msg.includes('401') || msg.includes('403')) return 'The jukebox needs to reconnect to Spotify. Please let a member of staff know.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) return 'The jukebox lost its internet connection for a moment.'
  return 'Something went wrong loading this. Please try again.'
}

export default function ErrorState({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: compact ? '20px 16px' : '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M3 9.5a14 14 0 0 1 18 0M6.2 13a9 9 0 0 1 11.6 0M9.4 16.4a4.2 4.2 0 0 1 5.2 0" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="19.4" r="1.2" fill="rgba(255,255,255,0.35)" />
          <path d="M4 4l16 16" stroke="#f0c14a" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600 }}>Couldn&apos;t load</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 4, maxWidth: 320, lineHeight: 1.45 }}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 999, background: '#f0c14a', color: '#1a120a', fontSize: 15, fontWeight: 700, boxShadow: '0 6px 18px rgba(240,193,74,0.25)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.7-4M12.5 1.8V4.4H9.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Try again
        </button>
      )}
    </div>
  )
}
