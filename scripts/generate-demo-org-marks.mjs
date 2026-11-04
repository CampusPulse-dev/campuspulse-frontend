import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const items = [
  ['sigma-club-ui.webp', 'S', '#5A189A', '#E0AAFF'],
  ['wole-soyinka-theatre.webp', 'W', '#3B145F', '#FF9EB0'],
  ['ui-sports-council.webp', 'UI', '#0D8A5E', '#3EE2A8'],
  ['gdg-on-campus-ui.webp', 'G', '#173B7A', '#7FB2F0'],
  ['jci-ibadan-varsity.webp', 'J', '#8F5B00', '#FAC775'],
  ['ui-film-society.webp', 'F', '#24104F', '#C77DFF'],
];

await Promise.all(
  items.map(async ([file, mark, background, accent]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill="${background}"/>
      <circle cx="256" cy="230" r="132" fill="none" stroke="${accent}" stroke-width="18" opacity=".9"/>
      <path d="M128 244h65l24-54 43 113 28-66 20 36h76" fill="none" stroke="${accent}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="256" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="62" font-weight="700" letter-spacing="4" fill="#fff">${mark}</text>
    </svg>`;
    await sharp(Buffer.from(svg))
      .webp({ quality: 88 })
      .toFile(path.join(root, 'public/demo/orgs', file));
  }),
);
