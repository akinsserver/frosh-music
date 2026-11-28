import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getInnertube } from './services/innertube.js';
import { getStreamerDiagnostics } from './services/streamer.js';
import { searchRouter } from './routes/search.js';
import { homeRouter } from './routes/home.js';
import { albumRouter } from './routes/album.js';
import { artistRouter } from './routes/artist.js';
import { playlistRouter } from './routes/playlist.js';
import { streamRouter } from './routes/stream.js';
import { lyricsRouter } from './routes/lyrics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Middlewares: CORS Origin Whitelist
const defaultAllowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : (process.env.NODE_ENV === 'production' ? defaultAllowed : ['*']);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization', 'x-api-key', 'x-frosh-token', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges', 'Content-Type']
}));

// Shared Server-to-Server Secret Key Protection (MUSIC_API_KEY)
// Any request lacking the matching x-api-key header is immediately rejected with 403 Forbidden.
const requiredApiKey = process.env.MUSIC_API_KEY || process.env.FROSH_API_SECRET;
if (requiredApiKey) {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path === '/health') return next();
    const key = req.headers['x-api-key'] || req.headers['x-frosh-token'] || req.query.api_key;
    if (key !== requiredApiKey) {
      res.status(403).json({ error: 'Forbidden: Invalid or missing API key' });
      return;
    }
    next();
  });
}

app.use(express.json());

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  const url = req.originalUrl || req.url;
  next();
  // Don't log full binary stream completions to prevent terminal clutter
  if (!url.startsWith('/api/stream/')) {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${url} - ${duration}ms`);
  }
});

// Root and Health check endpoints
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'frosh-music-server',
    message: 'Frosh Music Backend is running',
    endpoints: {
      health: '/api/health',
      home: '/api/home',
      search: '/api/search?q=...'
    }
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'frosh-music-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    streamer: getStreamerDiagnostics(),
  });
});

// API Routes
app.use('/api/search', searchRouter);
app.use('/api/home', homeRouter);
app.use('/api/album', albumRouter);
app.use('/api/artist', artistRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/stream', streamRouter);
app.use('/api/lyrics', lyricsRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start Server and warm up InnerTube instance
const server = app.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`🎵 Frosh Music Server listening on http://${HOST}:${PORT}`);
  console.log(`📡 Ready for web/TV streaming & Cloudflare tunnel`);
  console.log(`===============================================`);

  // Pre-warm InnerTube in the background
  getInnertube().catch(err => {
    console.warn('[InnerTube] Background pre-warm error:', err.message);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Frosh Music Server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nTerminating Frosh Music Server...');
  server.close(() => {
    console.log('Server terminated.');
    process.exit(0);
  });
});

// Prevent client disconnects / stream aborts from crashing the server process
process.on('uncaughtException', (err: any) => {
  if (err?.name === 'AbortError' || err?.code === 'ECONNRESET' || err?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return;
  }
  console.error('[Process] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  if (reason?.name === 'AbortError' || reason?.code === 'ECONNRESET') {
    return;
  }
  console.error('[Process] Unhandled Rejection:', reason);
});
