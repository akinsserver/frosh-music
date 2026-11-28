import { NextRequest, NextResponse } from 'next/server';

// In-memory translation cache: key = `${lang}:${hash}`
const translationCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 500;

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

async function translateChunk(chunk: string[], targetLang: string): Promise<string[]> {
  const text = chunk.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    targetLang
  )}&dt=t`;

  const body = new URLSearchParams({ q: text }).toString();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Google Translate responded with ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return chunk;
  }

  const fullTranslated = (data[0] as [string, string][]).map((item) => item[0]).join('');
  const translatedLines = fullTranslated.split('\n');

  // Pad if Google collapsed trailing blank lines
  while (translatedLines.length < chunk.length) {
    translatedLines.push('');
  }
  return translatedLines.slice(0, chunk.length);
}

/** Split lines into chunks capped by both line count and total character length */
function buildChunks(lines: string[], maxLines = 25, maxChars = 1400): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const line of lines) {
    const len = (line || '').length + 1;
    if (current.length > 0 && (current.length >= maxLines || currentChars + len > maxChars)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(line);
    currentChars += len;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lines, targetLang } = body as { lines: string[]; targetLang: string };

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ translated: [] });
    }

    if (!targetLang || targetLang === 'off') {
      return NextResponse.json({ translated: lines });
    }

    const cacheKey = `${targetLang}:${simpleHash(lines.join('||'))}`;
    if (translationCache.has(cacheKey)) {
      return NextResponse.json({ translated: translationCache.get(cacheKey)! });
    }

    const chunks = buildChunks(lines, 25, 1400);
    const chunkResults: string[][] = new Array(chunks.length);

    // Run up to 4 chunks concurrently for fast response without rate-limiting
    const CONCURRENCY = 4;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (chunk, offset) => {
          const idx = i + offset;
          try {
            chunkResults[idx] = await translateChunk(chunk, targetLang);
          } catch (chunkErr) {
            console.warn(`Translation chunk ${idx} error:`, chunkErr);
            chunkResults[idx] = chunk;
          }
        })
      );
    }

    const results = chunkResults.flat();

    // Only cache if at least some text actually changed (avoid caching failed rate-limit fallbacks)
    const anyChanged = results.some((r, idx) => r && r !== lines[idx]);
    if (anyChanged) {
      if (translationCache.size > MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, results);
    }

    return NextResponse.json({ translated: results });
  } catch (err: any) {
    console.error('Translation route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Translation failed' },
      { status: 500 }
    );
  }
}
