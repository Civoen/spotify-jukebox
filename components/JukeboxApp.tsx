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
  }, [setAccessToken])

  if (accessToken === null) {
    return <LoginScreen />
  }

  return <JukeboxMain />
}
