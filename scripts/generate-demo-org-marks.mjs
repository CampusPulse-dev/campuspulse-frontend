import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { writeDemoWebp } from './write-demo-webp.mjs';

const size = 512;
const maxBytes = 40_000;
const root = new URL('../', import.meta.url);
const tokens = await readFile(new URL('src/styles/tokens.css', root), 'utf8');
const inter = await readFile(new URL('src/app/fonts/InterCore.woff2', root));

const clubs = [
  [
    'sigma-club-ui',
    'ΣC',
    'social',
    '<path d="M256 54v70m-35-35h70m-59-24 48 48m0-48-48 48M256 388v70m-35-35h70m-59-24 48 48m0-48-48 48"/>',
  ],
  [
    'wole-soyinka-theatre',
    'WS',
    'performance',
    '<path transform="translate(0 -42)" d="M36 238Q89 92 256 92t220 146M69 142q43 36 115 40m259-40q-43 36-115 40"/>',
  ],
  [
    'ui-sports-council',
    'SC',
    'sports',
    '<rect x="63" y="85" width="386" height="342" rx="26"/><path d="M63 169h54v174H63m386-174h-54v174h54M256 85v61m0 220v61"/>',
  ],
  [
    'gdg-on-campus-ui',
    'GDG',
    'academic',
    '<path d="m146 117-86 139 86 139m220-278 86 139-86 139"/>',
  ],
  [
    'jci-ibadan-varsity',
    'JCI',
    'club',
    '<path d="M99 206q-5 138 115 195m199-195q5 138-115 195M125 280l-38-23m58 58-43-12m71 47-42 1m256-71 38-23m-58 58 43-12m-71 47 42 1"/>',
  ],
  [
    'ui-film-society',
    'FS',
    'performance',
    '<path d="M111 101h290m-290 310h290" stroke-width="32" stroke-dasharray="25 21"/><rect x="100" y="138" width="312" height="236" rx="15"/>',
    0.7,
  ],
];

function luminance(color) {
  const linear = color.map((byte) => {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function background(category, shade = 1) {
  const match = tokens.match(new RegExp(`--cat-${category}: #([0-9a-f]{6});`, 'i'));
  if (!match) throw new Error(`Missing category token for ${category}`);
  const channels = match[1].match(/../g).map((hex) => parseInt(hex, 16));
  let color = channels.map((byte) => Math.round(byte * shade));
  while (1.05 / (luminance(color) + 0.05) < 4.5) {
    color = color.map((byte) => Math.floor(byte * 0.98));
  }
  return '#' + color.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.evaluate(async (font) => {
    const face = new FontFace('Demo Inter', `url(data:font/woff2;base64,${font})`, {
      weight: '400 700',
    });
    document.fonts.add(await face.load());
  }, inter.toString('base64'));

  for (const [slug, label, category, motif, shade] of clubs) {
    const monogram = await page.evaluate(
      ({ label, size }) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        const sigma = label === 'ΣC';
        context.font = `700 ${label.length > 2 ? 128 : 156}px "Demo Inter"`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#fff';
        context.fillText(sigma ? 'C' : label, sigma ? 309 : size / 2, size / 2);
        if (sigma) {
          // The Latin font subset omits Greek. Draw sigma at the Inter cap height.
          context.strokeStyle = '#fff';
          context.lineWidth = 15;
          context.lineJoin = 'round';
          context.beginPath();
          context.moveTo(236, 202);
          context.lineTo(170, 202);
          context.lineTo(216, 255);
          context.lineTo(170, 308);
          context.lineTo(236, 308);
          context.stroke();
        }
        return canvas.toDataURL().split(',')[1];
      },
      { label, size },
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${background(category, shade)}"/>
      <g fill="none" stroke="#fff" stroke-width="12" opacity=".25" stroke-linecap="round" stroke-linejoin="round">${motif}</g>
      <image width="${size}" height="${size}" xlink:href="data:image/png;base64,${monogram}"/>
    </svg>`;
    const mark = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
    if (mark.length > maxBytes) throw new Error(`${slug} exceeds ${maxBytes} bytes`);
    await writeDemoWebp(new URL(`public/demo/orgs/${slug}.webp`, root), mark);
  }
} finally {
  await browser.close();
}
