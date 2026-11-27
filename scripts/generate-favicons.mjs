import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const require = createRequire(path.join(rootDir, 'music-web', 'package.json'));
const sharp = require('sharp');

const svgPath = path.join(rootDir, 'music-web', 'src', 'app', 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generatePng(size, outRelPath) {
  const dest = path.join(rootDir, outRelPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log(`Generated: ${outRelPath} (${size}x${size})`);
}

// Build a multi-size ICO from 16x16, 32x32, 48x48 PNG buffers
async function buildIco(sizes, outRelPaths) {
  const pngBuffers = await Promise.all(
    sizes.map((s) => sharp(svgBuffer).resize(s, s).png().toBuffer())
  );

  const count = pngBuffers.length;
  // ICONDIR header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4); // count of images

  let offset = 6 + count * 16;
  const entries = [];

  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    offset += buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...entries, ...pngBuffers]);

  for (const outRelPath of outRelPaths) {
    const dest = path.join(rootDir, outRelPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, icoBuffer);
    console.log(`Generated ICO: ${outRelPath}`);
  }
}

async function main() {
  await generatePng(512, 'music-web/public/icons/icon-512.png');
  await generatePng(192, 'music-web/public/icons/icon-192.png');
  await generatePng(180, 'music-web/public/icons/apple-touch-icon.png');
  await generatePng(180, 'music-web/src/app/apple-icon.png');
  await generatePng(32, 'music-web/public/favicon-32x32.png');
  await generatePng(16, 'music-web/public/favicon-16x16.png');

  await buildIco([16, 32, 48], [
    'music-web/src/app/favicon.ico',
    'music-web/public/favicon.ico',
  ]);

  console.log('✨ All "FM" icons and favicons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});
