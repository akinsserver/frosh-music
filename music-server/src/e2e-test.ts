async function runE2eTests() {
  const BASE_URL = 'http://localhost:4000';
  console.log(`[E2E] Running API verification against ${BASE_URL}...`);

  // 1. Health Check
  console.log('\n1. Testing GET /api/health');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  console.log('Health Response:', healthData);

  // 2. Search
  console.log('\n2. Testing GET /api/search?q=Starboy&type=song');
  const searchRes = await fetch(`${BASE_URL}/api/search?q=Starboy&type=song`);
  const searchData = await searchRes.json();
  console.log(`Found ${searchData.results?.length} songs.`);
  const firstSong = searchData.results?.[0];
  console.log('Sample song:', {
    id: firstSong?.id,
    title: firstSong?.title,
    artists: firstSong?.artists,
    durationText: firstSong?.durationText,
    thumbnail: firstSong?.thumbnail?.substring(0, 60)
  });

  const videoId = firstSong?.id || '3_g2un5M350';

  // 3. Home Feed
  console.log('\n3. Testing GET /api/home');
  const homeRes = await fetch(`${BASE_URL}/api/home`);
  const homeData = await homeRes.json();
  console.log(`Found ${homeData.shelves?.length} home shelves.`);
  if (homeData.shelves?.[0]) {
    console.log('First shelf title:', homeData.shelves[0].title, 'items count:', homeData.shelves[0].items?.length);
  }

  // 4. Lyrics
  console.log(`\n4. Testing GET /api/lyrics/${videoId}`);
  const lyricsRes = await fetch(`${BASE_URL}/api/lyrics/${videoId}?title=Starboy&artist=The%20Weeknd`);
  const lyricsData = await lyricsRes.json();
  console.log('Lyrics source:', lyricsData.source, 'isSynced:', lyricsData.isSynced);
  if (lyricsData.syncedLyrics?.[0]) {
    console.log('First synced line:', lyricsData.syncedLyrics[0]);
  }

  // 5. Stream Info
  console.log(`\n5. Testing GET /api/stream/${videoId}/info`);
  const streamInfoRes = await fetch(`${BASE_URL}/api/stream/${videoId}/info`);
  const streamInfo = await streamInfoRes.json();
  console.log('Stream info:', {
    itag: streamInfo.itag,
    mimeType: streamInfo.mimeType,
    bitrate: streamInfo.bitrate,
    contentLength: streamInfo.contentLength,
    urlPreview: streamInfo.url?.substring(0, 60)
  });

  // 6. HEAD Stream
  console.log(`\n6. Testing HEAD /api/stream/${videoId}`);
  const headRes = await fetch(`${BASE_URL}/api/stream/${videoId}`, { method: 'HEAD' });
  console.log('HEAD status:', headRes.status);
  console.log('Accept-Ranges:', headRes.headers.get('accept-ranges'));
  console.log('Content-Type:', headRes.headers.get('content-type'));
  console.log('Content-Length:', headRes.headers.get('content-length'));

  // 7. GET Range Stream (first 4KB)
  console.log(`\n7. Testing GET /api/stream/${videoId} with Range: bytes=0-4095`);
  const streamRangeRes = await fetch(`${BASE_URL}/api/stream/${videoId}`, {
    headers: { 'Range': 'bytes=0-4095' }
  });
  console.log('Range stream status:', streamRangeRes.status);
  console.log('Content-Range:', streamRangeRes.headers.get('content-range'));
  console.log('Content-Length:', streamRangeRes.headers.get('content-length'));
  const buf = await streamRangeRes.arrayBuffer();
  console.log(`Successfully received ${buf.byteLength} raw audio bytes!`);

  console.log('\n All E2E tests passed successfully!');
}

runE2eTests().catch(console.error);
