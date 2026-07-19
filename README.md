# 🎵 Jukebox — Spotify Jukebox App

A retro-modern vertical jukebox powered by the Spotify API.

## Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/callback` to **Redirect URIs**
4. Copy your **Client ID**

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/callback
```

> Note: `SPOTIFY_CLIENT_SECRET` is not needed — the app uses PKCE for auth (no secret exposed).

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- **Spotify OAuth** via PKCE (no backend needed)
- **Search** Spotify's full catalog in real-time
- **Queue system** — add, remove, skip tracks
- **Now Playing** with progress bar and controls
- **Spotify Web Playback SDK** for full playback (Premium required)
- **New releases** browsing on home screen
- Neon dark UI with glassmorphism effects

## Playback Notes

- **Spotify Premium**: Full playback via Web Playback SDK
- **Free accounts**: Tap tracks to add to queue; playback controlled from Spotify app

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Zustand (state management)
- Spotify Web API + Web Playback SDK
