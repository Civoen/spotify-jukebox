'use client'

import { useEffect } from 'react'
import { useJukeboxStore } from '@/lib/store'
import { getValidAccessToken } from '@/lib/spotify'
import LoginScreen from './LoginScreen'
import JukeboxMain from './JukeboxMain'

export default function JukeboxApp() {
  const { accessToken, setAccessToken } = useJukeboxStore()

  useEffect(() => {
    getValidAccessToken().then((token) => {
      setAccessToken(token)
    })

    // The check above only runs once, when the app first loads — but this
    // jukebox is meant to stay open in a venue for hours or days at a time,
    // and Spotify tokens expire after 1 hour. Without this, whoever's using
    // it would eventually hit a 401 mid-session with no way to recover short
    // of reloading the page. Checking periodically catches it proactively —
    // getValidAccessToken() only actually calls Spotify when the token is
    // genuinely close to expiring, so this stays cheap the rest of the time.
    const interval = setInterval(() => {
      getValidAccessToken().then((token) => {
        setAccessToken(token)
      })
    }, 4 * 60 * 1000) // check every 4 minutes

    return () => clearInterval(interval)
  }, [setAccessToken])

  if (accessToken === null) {
    return <LoginScreen />
  }

  return <JukeboxMain />
}
