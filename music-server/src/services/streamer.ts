import type { Response, Request } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getInnertube } from './innertube.js';
import type { StreamFormatInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

interface CachedFormat {
  url: string;
  mimeType: string;
  bitrate: number;
  contentLength?: number;
  expiresAt: number;
}

// Cache TTL: 90 minutes (CDN URLs last ~6 hours)
const streamCache = new Map<string, CachedFormat>();
const CACHE_TTL_MS = 90 * 60 * 1000;

let resolvedYtDlpBinary: { exe: string; prefixArgs: string[] } | null = null;

function resolveYtDlpBinary(): { exe: string; prefixArgs: string[] } {
  if (resolvedYtDlpBinary) return resolvedYtDlpBinary;

  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    resolvedYtDlpBinary = { exe: process.env.YT_DLP_PATH, prefixArgs: [] };
    return resolvedYtDlpBinary;
  }

  const userProfile = process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';

  const candidates = [
    path.join(appData, 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(userProfile, 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    'yt-dlp.exe',
    'yt-dlp',
  ];

  for (const cand of candidates) {
    if (cand.includes(path.sep) && fs.existsSync(cand)) {
      resolvedYtDlpBinary = { exe: cand, prefixArgs: [] };
      return resolvedYtDlpBinary;
    }
  }

  if (fs.existsSync('C:\\Python314\\python.exe')) {
    resolvedYtDlpBinary = { exe: 'C:\\Python314\\python.exe', prefixArgs: ['-m', 'yt_dlp'] };
    return resolvedYtDlpBinary;
  }

  resolvedYtDlpBinary = { exe: 'yt-dlp', prefixArgs: [] };
  return resolvedYtDlpBinary;
}

/**
 * Extract direct audio stream URL using yt-dlp (handles VisionOS / Desktop unthrottled streams).
 */
async function extractWithYtDlp(videoId: string): Promise<StreamFormatInfo> {
  const { exe, prefixArgs } = resolveYtDlpBinary();
  const args = [
    ...prefixArgs,
    '-f', 'ba[ext=m4a]/ba',
    '--no-playlist',
    '--no-warnings',
    '--print', '%(url)s',
    '--print', '%(ext)s',
    '--print', '%(filesize,filesize_approx)s',
    '--print', '%(tbr)s',
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  const { stdout } = await execFileAsync(exe, args, { timeout: 15000 });
  const lines = stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  if (!lines[0] || !lines[0].startsWith('http')) {
    throw new Error(`Invalid yt-dlp stream extraction for ${videoId}`);
  }

  const url = lines[0];
  const ext = lines[1] || 'm4a';
  const contentLength = lines[2] && !isNaN(Number(lines[2])) ? Number(lines[2]) : undefined;
  const bitrate = lines[3] && !isNaN(Number(lines[3])) ? Math.round(Number(lines[3]) * 1000) : 128000;

  const mimeType = ext === 'webm' ? 'audio/webm' : 'audio/mp4';

  return {
    itag: ext === 'webm' ? 251 : 140,
    mimeType,
    bitrate,
    contentLength,
    url,
  };
}

/**
 * Fallback InnerTube extractor if yt-dlp is unavailable.
 */
async function extractWithInnerTube(videoId: string): Promise<StreamFormatInfo> {
  const yt = await getInnertube();
  let info = await yt.getInfo(videoId, { client: 'IOS' });
  let audioFormats = info.streaming_data?.adaptive_formats?.filter(
    (f) => f.has_audio && !f.has_video
  );

  if (!audioFormats || audioFormats.length === 0 || !audioFormats.some((f) => f.url)) {
    info = await yt.getInfo(videoId, { client: 'WEB' });
    audioFormats = info.streaming_data?.adaptive_formats?.filter(
      (f) => f.has_audio && !f.has_video
    );
  }

  if (!audioFormats || audioFormats.length === 0) {
    throw new Error(`No audio formats found for ${videoId}`);
  }

  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  let selectedFormat = audioFormats.find((f) => !!f.url);
  let directUrl: string | undefined = selectedFormat?.url;

  if (!directUrl && audioFormats[0]) {
    try {
      directUrl = await audioFormats[0].decipher(yt.session.player);
      selectedFormat = audioFormats[0];
    } catch (e: any) {
      console.warn(`[Streamer] InnerTube decipher failed for ${videoId}:`, e.message);
    }
  }

  if (!directUrl || !selectedFormat) {
    throw new Error(`Failed to extract audio stream for ${videoId}`);
  }

  return {
    itag: selectedFormat.itag,
    mimeType: selectedFormat.mime_type || 'audio/mp4',
    bitrate: selectedFormat.bitrate || 128000,
    contentLength: selectedFormat.content_length,
    audioSampleRate: selectedFormat.audio_sample_rate,
    url: directUrl,
  };
}

export async function resolveStreamFormat(videoId: string): Promise<StreamFormatInfo> {
  const cached = streamCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      itag: 140,
      mimeType: cached.mimeType,
      bitrate: cached.bitrate,
      contentLength: cached.contentLength,
      url: cached.url,
    };
  }

  let result: StreamFormatInfo;
  try {
    result = await extractWithYtDlp(videoId);
    console.log(`[Streamer] yt-dlp resolved ${videoId}: ${result.mimeType}, ${result.contentLength} bytes`);
  } catch (err: any) {
    console.warn(`[Streamer] yt-dlp failed (${err.message}), falling back to InnerTube for ${videoId}`);
    result = await extractWithInnerTube(videoId);
  }

  streamCache.set(videoId, {
    url: result.url,
    mimeType: result.mimeType,
    bitrate: result.bitrate,
    contentLength: result.contentLength,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

/** Strip codec parameters — browsers require clean MIME types in HTTP Content-Type */
function baseMime(mime: string): string {
  return mime.split(';')[0].trim();
}

/**
 * Handle HTTP audio streaming with native Range support.
 *
 * Browsers stream audio by issuing HTTP Range requests:
 *   - Initial probe/play: GET with Range: bytes=0-
 *   - Seeking/scrubbing: GET with Range: bytes=X-
 *
 * We forward the Range header to the resolved high-bitrate CDN audio stream,
 * returning HTTP 206 Partial Content with proper Content-Range and Content-Length.
 * Disconnects (pause / skip) cleanly abort the upstream stream.
 */
export async function handleAudioStream(
  req: Request,
  res: Response,
  videoId: string
): Promise<void> {
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    let format = await resolveStreamFormat(videoId);
    const contentType = baseMime(format.mimeType);

    // ── HEAD request ─────────────────────────────────────────────────────────
    if (req.method === 'HEAD') {
      res.status(200)
        .setHeader('Content-Type', contentType)
        .setHeader('Accept-Ranges', 'bytes')
        .setHeader('Cache-Control', 'no-cache');
      if (format.contentLength) {
        res.setHeader('Content-Length', String(format.contentLength));
      }
      res.end();
      return;
    }

    const rangeHeader = req.headers.range;

    const fetchFromCdn = async (url: string) => {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }
      return fetch(url, {
        headers,
        signal: abortController.signal,
      });
    };

    let cdnRes = await fetchFromCdn(format.url);

    // If CDN returns 403 or 410, bust cache and retry once
    if (cdnRes.status === 403 || cdnRes.status === 410) {
      console.warn(`[Streamer] CDN ${cdnRes.status} for ${videoId} — re-resolving stream URL`);
      streamCache.delete(videoId);
      format = await resolveStreamFormat(videoId);
      cdnRes = await fetchFromCdn(format.url);
    }

    if (!cdnRes.ok && cdnRes.status !== 206) {
      console.error(`[Streamer] CDN returned HTTP ${cdnRes.status} for ${videoId}`);
      if (!res.headersSent) {
        res.status(cdnRes.status).json({ error: `CDN error: ${cdnRes.statusText}` });
      }
      return;
    }

    const status = cdnRes.status === 206 ? 206 : 200;
    res.status(status)
      .setHeader('Content-Type', contentType)
      .setHeader('Accept-Ranges', 'bytes')
      .setHeader('Cache-Control', 'no-cache')
      .setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');

    const contentRange = cdnRes.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    const contentLength = cdnRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (!cdnRes.body) {
      res.end();
      return;
    }

    // Direct byte piping into Express response
    Readable.fromWeb(cdnRes.body as any).pipe(res);
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    console.error(`[Streamer] Error streaming ${videoId}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Stream error' });
    }
  }
}
