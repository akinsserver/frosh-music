import type { Response, Request } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { once } from 'events';
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
const CHUNK_SIZE = 1024 * 1024; // 1 MB bounded chunks (prevents Google Video CDN 403 on open-ended ranges)

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
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
    path.join(localAppData, 'Microsoft', 'WindowsApps', 'yt-dlp.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
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

/** Parse total file size from an HTTP Content-Range header like "bytes 0-1048575/2751716" */
function parseTotalFromContentRange(header: string | null): number | undefined {
  if (!header) return undefined;
  const m = header.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Write a ReadableStream<Uint8Array> cleanly to an Express Response with backpressure and abort safety */
async function pumpWebStreamToRes(
  body: ReadableStream<Uint8Array>,
  res: Response,
  signal: AbortSignal
): Promise<number> {
  const reader = body.getReader();
  let written = 0;
  try {
    while (!signal.aborted && !res.destroyed) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        if (signal.aborted || res.destroyed) break;
        const ok = res.write(value);
        written += value.length;
        if (!ok && !signal.aborted && !res.destroyed) {
          await once(res, 'drain');
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return written;
}

/**
 * Handle HTTP audio streaming with native Range support and bounded upstream chunks.
 *
 * Google Video CDN rejects open-ended `Range: bytes=0-` requests on adaptive DASH audio
 * with HTTP 403. We transparently translate any client range (or full download) into
 * bounded 1 MB upstream chunk fetches while returning the exact HTTP 206 / 200 contract
 * expected by desktop Chrome, Android, and iOS Safari AVPlayer.
 */
export async function handleAudioStream(
  req: Request,
  res: Response,
  videoId: string
): Promise<void> {
  const abortController = new AbortController();

  // Only abort when the response socket closes before finishing (safe in Node 20+)
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

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

    const fetchChunkFromCdn = async (url: string, start: number, end: number) => {
      return fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Range: `bytes=${start}-${end}`,
        },
        signal: abortController.signal,
      });
    };

    const rawRange = req.headers.range;
    let totalLength = format.contentLength;
    let reqStart = 0;
    let reqEnd: number | undefined;
    let isRangeRequest = false;

    if (rawRange) {
      const match = rawRange.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        isRangeRequest = true;
        reqStart = parseInt(match[1], 10);
        if (match[2]) {
          reqEnd = parseInt(match[2], 10);
        } else if (totalLength) {
          reqEnd = totalLength - 1;
        }
      }
    } else if (totalLength) {
      reqEnd = totalLength - 1;
    }

    if (totalLength && reqStart >= totalLength) {
      res.status(416)
        .setHeader('Content-Range', `bytes */${totalLength}`)
        .end();
      return;
    }

    if (totalLength && reqEnd !== undefined) {
      reqEnd = Math.min(reqEnd, totalLength - 1);
    }

    // Fetch first chunk BEFORE sending HTTP headers so 403/410 retries stay clean
    const firstChunkEnd =
      reqEnd !== undefined
        ? Math.min(reqStart + CHUNK_SIZE - 1, reqEnd)
        : reqStart + CHUNK_SIZE - 1;

    let firstRes = await fetchChunkFromCdn(format.url, reqStart, firstChunkEnd);
    if (firstRes.status === 403 || firstRes.status === 410) {
      console.warn(`[Streamer] CDN ${firstRes.status} for ${videoId} — re-resolving stream URL`);
      streamCache.delete(videoId);
      format = await resolveStreamFormat(videoId);
      totalLength = format.contentLength;
      firstRes = await fetchChunkFromCdn(format.url, reqStart, firstChunkEnd);
    }

    if (!firstRes.ok && firstRes.status !== 206) {
      console.error(`[Streamer] CDN returned HTTP ${firstRes.status} for ${videoId}`);
      if (!res.headersSent) {
        res.status(firstRes.status).json({ error: `CDN error: ${firstRes.statusText}` });
      }
      return;
    }

    // Backfill totalLength from CDN Content-Range if extractor omitted filesize
    const cdnTotal = parseTotalFromContentRange(firstRes.headers.get('content-range'));
    if (cdnTotal && !totalLength) {
      totalLength = cdnTotal;
    }

    if (totalLength) {
      reqEnd = reqEnd !== undefined ? Math.min(reqEnd, totalLength - 1) : totalLength - 1;
    }

    const status = isRangeRequest ? 206 : 200;
    res.status(status)
      .setHeader('Content-Type', contentType)
      .setHeader('Accept-Ranges', 'bytes')
      .setHeader('Cache-Control', 'no-cache')
      .setHeader(
        'Access-Control-Expose-Headers',
        'Content-Range, Content-Length, Accept-Ranges, Content-Type'
      );

    if (isRangeRequest && totalLength && reqEnd !== undefined) {
      res.setHeader('Content-Range', `bytes ${reqStart}-${reqEnd}/${totalLength}`);
      res.setHeader('Content-Length', String(reqEnd - reqStart + 1));
    } else if (totalLength && !isRangeRequest) {
      res.setHeader('Content-Length', String(totalLength));
    } else {
      const cr = firstRes.headers.get('content-range');
      const cl = firstRes.headers.get('content-length');
      if (isRangeRequest && cr) res.setHeader('Content-Range', cr);
      if (cl) res.setHeader('Content-Length', cl);
    }

    // Stream first chunk immediately
    let offset = reqStart;
    if (firstRes.body) {
      const written = await pumpWebStreamToRes(firstRes.body, res, abortController.signal);
      offset += written;
    }

    // Stream any remaining chunks sequentially (bounded 1 MB each)
    const targetEnd = reqEnd;
    while (
      !abortController.signal.aborted &&
      !res.destroyed &&
      (targetEnd === undefined || offset <= targetEnd)
    ) {
      // Stop if CDN didn't return a full chunk and no explicit targetEnd remains
      if (offset === reqStart) break;

      const chunkEnd =
        targetEnd !== undefined
          ? Math.min(offset + CHUNK_SIZE - 1, targetEnd)
          : offset + CHUNK_SIZE - 1;

      if (targetEnd !== undefined && offset > targetEnd) break;

      let nextRes = await fetchChunkFromCdn(format.url, offset, chunkEnd);
      if (nextRes.status === 403 || nextRes.status === 410) {
        streamCache.delete(videoId);
        format = await resolveStreamFormat(videoId);
        nextRes = await fetchChunkFromCdn(format.url, offset, chunkEnd);
      }

      if (!nextRes.ok && nextRes.status !== 206) {
        break;
      }

      if (!nextRes.body) break;
      const written = await pumpWebStreamToRes(nextRes.body, res, abortController.signal);
      if (written === 0) break;
      offset += written;
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    console.error(`[Streamer] Error streaming ${videoId}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Stream error' });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
