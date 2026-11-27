# 🎵 Vyla Music

> A Spotify / Metrolist-style music streaming platform backed by a self-hosted audio streaming server running on a Mini PC (residential IP) and a modern Next.js 15 Web/TV frontend deployed to Vercel / Cloudflare.

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────────────────┐
                    │       Vyla Music Web & TV App            │
                    │   (Next.js 15 App Router on Vercel)      │
                    └─────────────────────┬────────────────────┘
                                          │
                        API & Range Audio Stream Requests
                                          │
                                          ▼
                         https://music-api.akin.qzz.io
                                          │
                                          │ (Cloudflare Tunnel)
                                          ▼
                    ┌──────────────────────────────────────────┐
                    │      Self-Hosted Mini PC Server          │
                    │         (`music-server` :4000)           │
                    │   - Node.js + Express + TypeScript       │
                    │   - InnerTube (YouTube.js) Engine        │
                    │   - Zero-Disk RAM Range Stream Proxy     │
                    │   - LRCLIB Synced Karaoke Lyrics Engine  │
                    └─────────────────────┬────────────────────┘
                                          │
                            Direct Audio Stream Resolving
                                 (Residential IP)
                                          ▼
                                YouTube Music CDN
```

---

## 📦 Directory Structure

```
froshMusic/
├── music-server/           # Phase 1: Self-hosted Node.js / Express audio backend
│   ├── src/
│   │   ├── index.ts        # Express app entrypoint & middleware
│   │   ├── services/
│   │   │   ├── innertube.ts # YouTube.js client & normalized data transformers
│   │   │   ├── streamer.ts  # HTTP Range audio streamer & URL resolver
│   │   │   └── lyrics.ts    # LRCLIB & InnerTube synced lyrics parser
│   │   ├── routes/
│   │   │   ├── search.ts    # Search songs, albums, artists, playlists
│   │   │   ├── home.ts      # Trending charts, quick picks, shelves
│   │   │   ├── album.ts     # Album tracks and metadata
│   │   │   ├── artist.ts    # Artist discography, top songs, albums
│   │   │   ├── playlist.ts  # Playlist tracks and details
│   │   │   ├── stream.ts    # Binary audio streaming & format info
│   │   │   └── lyrics.ts    # Synced & plain text lyrics
│   │   └── types/           # Unified TypeScript definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── music-web/              # Phase 2: Next.js 15 Web & TV Frontend (Upcoming)
└── README.md
```

---

## 🚀 Phase 1: `music-server` API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & uptime status |
| `GET` | `/api/search?q={query}&type={song\|album\|artist}` | Search tracks, albums, artists |
| `GET` | `/api/home` | Home feed shelves, trending tracks, quick picks |
| `GET` | `/api/album/:id` | Get album metadata and tracklist |
| `GET` | `/api/artist/:id` | Get artist details, top songs, and discography |
| `GET` | `/api/playlist/:id` | Get playlist details and tracklist |
| `GET` | `/api/stream/:videoId/info` | Audio stream format info (bitrate, mime, direct URL) |
| `HEAD` | `/api/stream/:videoId` | Audio headers probe (`Accept-Ranges`, `Content-Length`) |
| `GET` | `/api/stream/:videoId` | **HTTP Range-supported audio binary stream** |
| `GET` | `/api/lyrics/:videoId` | Synchronized karaoke lyrics (`LRCLIB` + InnerTube) |

---

## 🛠️ Running `music-server` on your Mini PC

### 1. Install & Build
```bash
cd music-server
npm install
npm run build
```

### 2. Configure Environment (`.env`)
```env
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=*
NODE_ENV=production
```

### 3. Start Server
```bash
# Development (with live-reload):
npm run dev

# Production:
npm start

# With PM2 (recommended for Mini PC 24/7 background service):
pm2 start dist/index.js --name "vyla-music-server"
pm2 save
```

### 4. Expose via Cloudflare Tunnel
On your Mini PC:
```bash
cloudflared tunnel run --url http://localhost:4000
# Or route your hostname (e.g. music-api.akin.qzz.io) to localhost:4000
```

---

## 🔮 Next: Phase 2 (`music-web`)
Next phase will scaffold the modern Next.js 15 frontend with:
- Dark mode Spotify / Metrolist visual styling.
- Responsive layout with desktop, mobile mini-player, and Android TV / Firestick D-pad remote navigation.
- Persistent HTML5 / Web Audio player engine with continuous playback across routes.
- Real-time synced lyrics modal with word/line highlighting.
- Supabase auth & user library (playlists, likes, history).
