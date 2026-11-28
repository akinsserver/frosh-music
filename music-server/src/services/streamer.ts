import type { Response, Request } from 'express';
import { execFile, execFileSync } from 'child_process';
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
  extractor?: 'yt-dlp' | 'innertube';
  expiresAt: number;
}

// Cache TTL: 90 minutes (CDN URLs last ~6 hours)
const streamCache = new Map<string, CachedFormat>();
const inFlightResolves = new Map<string, Promise<StreamFormatInfo>>();

// Small head-chunk RAM cache (512 KB per track, max 15 tracks = ~7.5 MB)
// Makes iOS Safari's sequential Range probes (bytes=0-1, bytes=0-65535) instant (0ms).
const HEAD_CACHE_BYTES = 512 * 1024;
const MAX_HEAD_CACHE_ENTRIES = 15;
const headChunkCache = new Map<
  string,
  { buf: Buffer; totalLength?: number; contentType: string; expiresAt: number }
>();

const CACHE_TTL_MS = 90 * 60 * 1000;
const CHUNK_SIZE = 1024 * 1024; // 1 MB bounded chunks (prevents Google Video CDN 403 on open-ended ranges)

let resolvedYtDlpBinary: { exe: string; prefixArgs: string[] } | null = null;
let lastYtDlpError: string | null = null;

function findExeInDir(dir: string, targetName: string, maxDepth = 2): string | null {
  if (!dir || maxDepth < 0 || !fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return fullPath;
      }
      if (entry.isDirectory() && maxDepth > 0) {
        const nested = findExeInDir(fullPath, targetName, maxDepth - 1);
        if (nested) return nested;
      }
    }
  } catch {
    // ignore permission errors
  }
  return null;
}

function resolveYtDlpBinary(): { exe: string; prefixArgs: string[] } {
  if (resolvedYtDlpBinary) return resolvedYtDlpBinary;

  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    resolvedYtDlpBinary = { exe: process.env.YT_DLP_PATH, prefixArgs: [] };
    return resolvedYtDlpBinary;
  }

  const userProfile = process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';

  // 1. Scan WinGet Packages directly (avoids WinGet\Links App Execution Alias quirks)
  const wingetDirs = [
    path.join(localAppData, 'Microsoft', 'WinGet', 'Packages'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
    'C:\\Program Files\\WinGet\\Packages',
  ];
  for (const pkgRoot of wingetDirs) {
    if (fs.existsSync(pkgRoot)) {
      try {
        for (const folder of fs.readdirSync(pkgRoot)) {
          if (folder.toLowerCase().includes('yt-dlp')) {
            const found = findExeInDir(path.join(pkgRoot, folder), 'yt-dlp.exe', 2);
            if (found) {
              resolvedYtDlpBinary = { exe: found, prefixArgs: [] };
              return resolvedYtDlpBinary;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 2. Direct candidate paths (WinGet Links, Scoop, Chocolatey, Python Scripts)
  const candidates = [
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
    path.join(localAppData, 'Microsoft', 'WindowsApps', 'yt-dlp.exe'),
    path.join(userProfile, 'scoop', 'shims', 'yt-dlp.exe'),
    'C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe',
  ];
  for (const pyVer of ['Python315', 'Python314', 'Python313', 'Python312', 'Python311', 'Python310']) {
    candidates.push(
      path.join(appData, 'Python', pyVer, 'Scripts', 'yt-dlp.exe'),
      path.join(userProfile, 'AppData', 'Roaming', 'Python', pyVer, 'Scripts', 'yt-dlp.exe'),
      path.join(localAppData, 'Programs', 'Python', pyVer, 'Scripts', 'yt-dlp.exe'),
      `C:\\${pyVer}\\Scripts\\yt-dlp.exe`
    );
  }

  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) {
      resolvedYtDlpBinary = { exe: cand, prefixArgs: [] };
      return resolvedYtDlpBinary;
    }
  }

  // 3. Python module fallback (python -m yt_dlp)
  for (const pyVer of ['Python314', 'Python313', 'Python312']) {
    const pyExe = `C:\\${pyVer}\\python.exe`;
    if (fs.existsSync(pyExe)) {
      resolvedYtDlpBinary = { exe: pyExe, prefixArgs: ['-m', 'yt_dlp'] };
      return resolvedYtDlpBinary;
    }
  }

  // 4. OS PATH lookup (where.exe / which)
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    const out = execFileSync(cmd, ['yt-dlp'], { encoding: 'utf8', timeout: 3000 }).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      resolvedYtDlpBinary = { exe: firstLine, prefixArgs: [] };
      return resolvedYtDlpBinary;
    }
  } catch {
    // not in PATH
  }

  return { exe: 'yt-dlp', prefixArgs: [] };
}

export function getStreamerDiagnostics() {
  const resolved = resolveYtDlpBinary();
  return {
    ytDlpExe: resolved.exe,
    prefixArgs: resolved.prefixArgs,
    lastYtDlpError,
  };
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
    extractor: 'yt-dlp',
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

  // Prefer audio/mp4 (AAC) for universal iOS Safari / AVPlayer compatibility, then highest bitrate
  audioFormats.sort((a, b) => {
    const aMp4 = (a.mime_type || '').includes('mp4') ? 1 : 0;
    const bMp4 = (b.mime_type || '').includes('mp4') ? 1 : 0;
    if (aMp4 !== bMp4) return bMp4 - aMp4;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });

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
    extractor: 'innertube',
  };
}

export async function resolveStreamFormat(
  videoId: string,
  forceYtDlp = false
): Promise<StreamFormatInfo> {
  if (!forceYtDlp) {
    const cached = streamCache.get(videoId);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        itag: 140,
        mimeType: cached.mimeType,
        bitrate: cached.bitrate,
        contentLength: cached.contentLength,
        url: cached.url,
        extractor: cached.extractor,
      };
    }

    const existing = inFlightResolves.get(videoId);
    if (existing) {
      return existing;
    }
  }

  const resolvePromise = (async (): Promise<StreamFormatInfo> => {
    let result: StreamFormatInfo;

    if (!forceYtDlp) {
      try {
        result = await extractWithInnerTube(videoId);
        console.log(
          `[Streamer] InnerTube resolved ${videoId}: ${result.mimeType}, ${result.contentLength} bytes`
        );
      } catch (innerErr: any) {
        console.warn(
          `[Streamer] InnerTube failed (${innerErr?.message || innerErr}), falling back to yt-dlp for ${videoId}`
        );
        result = await extractWithYtDlp(videoId);
        lastYtDlpError = null;
        console.log(
          `[Streamer] yt-dlp resolved ${videoId}: ${result.mimeType}, ${result.contentLength} bytes`
        );
      }
    } else {
      result = await extractWithYtDlp(videoId);
      lastYtDlpError = null;
      console.log(
        `[Streamer] yt-dlp (forced) resolved ${videoId}: ${result.mimeType}, ${result.contentLength} bytes`
      );
    }

    streamCache.set(videoId, {
      url: result.url,
      mimeType: result.mimeType,
      bitrate: result.bitrate,
      contentLength: result.contentLength,
      extractor: result.extractor,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  })();

  if (!forceYtDlp) {
    inFlightResolves.set(videoId, resolvePromise);
  }

  try {
    return await resolvePromise;
  } finally {
    if (!forceYtDlp) {
      inFlightResolves.delete(videoId);
    }
  }
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

    // Fast path: Serve small iOS Safari head probes (bytes=0-1, bytes=0-65535) from RAM cache
    if (isRangeRequest && reqEnd !== undefined && reqEnd < HEAD_CACHE_BYTES) {
      const cachedHead = headChunkCache.get(videoId);
      if (cachedHead && Date.now() < cachedHead.expiresAt && reqEnd < cachedHead.buf.length) {
        const slice = cachedHead.buf.subarray(reqStart, reqEnd + 1);
        const total = cachedHead.totalLength ?? totalLength;
        res.status(206)
          .setHeader('Content-Type', cachedHead.contentType)
          .setHeader('Accept-Ranges', 'bytes')
          .setHeader('Cache-Control', 'no-cache')
          .setHeader(
            'Access-Control-Expose-Headers',
            'Content-Range, Content-Length, Accept-Ranges, Content-Type'
          );
        if (total) {
          res.setHeader('Content-Range', `bytes ${reqStart}-${reqEnd}/${total}`);
        }
        res.setHeader('Content-Length', String(slice.length));
        res.end(slice);
        return;
      }
    }

    // If this is an initial head probe (reqStart === 0, small reqEnd), fetch 512 KB once to warm headChunkCache
    const isSmallHeadProbe = isRangeRequest && reqStart === 0 && reqEnd !== undefined && reqEnd < HEAD_CACHE_BYTES;

    // Fetch first chunk BEFORE sending HTTP headers so 403/410 retries stay clean
    const firstChunkEnd = isSmallHeadProbe
      ? Math.min(HEAD_CACHE_BYTES - 1, totalLength ? totalLength - 1 : HEAD_CACHE_BYTES - 1)
      : reqEnd !== undefined
      ? Math.min(reqStart + CHUNK_SIZE - 1, reqEnd)
      : reqStart + CHUNK_SIZE - 1;

    let firstRes = await fetchChunkFromCdn(format.url, reqStart, firstChunkEnd);
    if (firstRes.status === 403 || firstRes.status === 410) {
      console.warn(`[Streamer] CDN ${firstRes.status} for ${videoId} — re-resolving via yt-dlp`);
      streamCache.delete(videoId);
      headChunkCache.delete(videoId);
      format = await resolveStreamFormat(videoId, true);
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

    if (isSmallHeadProbe && reqEnd !== undefined) {
      const fullBuf = Buffer.from(await firstRes.arrayBuffer());
      if (headChunkCache.size >= MAX_HEAD_CACHE_ENTRIES) {
        const oldestKey = headChunkCache.keys().next().value;
        if (oldestKey) headChunkCache.delete(oldestKey);
      }
      headChunkCache.set(videoId, {
        buf: fullBuf,
        totalLength,
        contentType,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const clampedEnd = Math.min(reqEnd, fullBuf.length - 1);
      const slice = fullBuf.subarray(reqStart, clampedEnd + 1);
      res.status(206)
        .setHeader('Content-Type', contentType)
        .setHeader('Accept-Ranges', 'bytes')
        .setHeader('Cache-Control', 'no-cache')
        .setHeader(
          'Access-Control-Expose-Headers',
          'Content-Range, Content-Length, Accept-Ranges, Content-Type'
        );
      if (totalLength) {
        res.setHeader('Content-Range', `bytes ${reqStart}-${clampedEnd}/${totalLength}`);
      }
      res.setHeader('Content-Length', String(slice.length));
      res.end(slice);
      return;
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
