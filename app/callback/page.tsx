'use client'

import { useEffect, useState } from 'react'
import { exchangeCodeForToken, storeToken } from '@/lib/spotify'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

export default function CallbackPage() {
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    const errorDesc = params.get('error_description')

    if (error) {
      setErrorDetail(`Spotify error: ${error}${errorDesc ? ` — ${errorDesc}` : ''}`)
      return
    }

    if (!code) {
      setErrorDetail('No authorisation code received from Spotify.')
      return
    }

    exchangeCodeForToken(code)
      .then((token) => {
        storeToken(token)
        window.location.replace(`${BASE}/`)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setErrorDetail(`Token exchange failed: ${msg}`)
      })
  }, [])

  if (errorDetail) {
    return (
      <div className="h-full flex items-center justify-center bg-jukebox px-6">
        <div className="max-w-sm w-full flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,45,120,0.15)', border: '1px solid rgba(255,45,120,0.3)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#ff2d78" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg">Login failed</h2>
            <p className="text-white/40 text-sm">Screenshot this screen and send it to the venue owner.</p>
          </div>

          <div className="rounded-xl p-4 font-mono text-xs break-all leading-relaxed"
            style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.2)', color: 'rgba(255,180,180,0.85)' }}>
            {errorDetail}
          </div>

          <button
            onClick={() => window.location.replace(`${BASE}/`)}
            className="w-full py-3 rounded-xl text-sm font-medium text-white/60 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center bg-jukebox">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-white/50 text-sm">Connecting to Spotify…</p>
      </div>
    </div>
  )
}
