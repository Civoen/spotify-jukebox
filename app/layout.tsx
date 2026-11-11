import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outside Inn Jukebox',
  description: 'The Outside Inn jukebox. Search for a song, add it to the queue and hear it play.',
  applicationName: 'Outside Inn Jukebox',
  appleWebApp: { capable: true, title: 'Outside Inn Jukebox', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
