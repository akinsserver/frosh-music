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
  )}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
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

  // If line count drifted slightly due to newline stripping, pad or trim to match chunk
  if (translatedLines.length < chunk.length) {
    while (translatedLines.length < chunk.length) {
      translatedLines.push('');
    }
  }
  return translatedLines.slice(0, chunk.length);
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

    // Process in chunks of 35 lines to prevent query string overflow
    const chunkSize = 35;
    const results: string[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      try {
        const translatedChunk = await translateChunk(chunk, targetLang);
        results.push(...translatedChunk);
      } catch (chunkErr) {
        console.warn(`Translation chunk error (${i}-${i + chunkSize}):`, chunkErr);
        // Fallback to original text for this chunk
        results.push(...chunk);
      }
    }

    // Save in cache
    if (translationCache.size > MAX_CACHE_SIZE) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, results);

    return NextResponse.json({ translated: results });
  } catch (err: any) {
    console.error('Translation route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Translation failed' },
      { status: 500 }
    );
  }
}
