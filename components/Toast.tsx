'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useJukeboxStore } from '@/lib/store'

// One shared toast for the whole app, driven by `showToast` in the store.
// Sits just above the bottom nav so it never covers what was just tapped.
export default function Toast() {
  const toast = useJukeboxStore((s) => s.toast)

  const accent = toast?.kind === 'error' ? '#ff6b6b' : toast?.kind === 'info' ? '#9adfff' : '#f0c14a'

  return (
    <div
      aria-live="polite"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 60, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 20px' }}
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'min(100%, 520px)',
              padding: '13px 20px 13px 14px', borderRadius: 999,
              background: 'rgba(22,18,14,0.94)',
              border: `1px solid ${accent}55`,
              boxShadow: `0 10px 30px rgba(0,0,0,0.45), 0 0 18px ${accent}22`,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              color: '#fff',
            }}
          >
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {toast.kind === 'error' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2.5V7M6 9.4v.1" stroke="#1a120a" strokeWidth="1.8" strokeLinecap="round" /></svg>
              ) : toast.kind === 'info' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 5.2V9.5M6 2.6v.1" stroke="#1a120a" strokeWidth="1.8" strokeLinecap="round" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.4 6.2L5 8.8L9.8 3.4" stroke="#1a120a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
