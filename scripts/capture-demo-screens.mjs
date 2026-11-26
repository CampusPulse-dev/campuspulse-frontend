import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { writeDemoWebp } from './write-demo-webp.mjs';

const origin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3104');
if (
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' ||
  !['localhost', '127.0.0.1'].includes(origin.hostname)
) {
  throw new Error('Use a local server built with NEXT_PUBLIC_DEMO_MODE=true.');
}
const output = new URL('../public/demo/screens/', import.meta.url);
const maxBytes = 120_000;
const wait = { timeout: 20_000 };
const browser = await chromium.launch();

async function signIn(page, email) {
  await page.goto('/sign-in');
  await page.getByLabel('Student or Personal Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/, wait);
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('demo:user'))), wait)
    .toBe(true);
}

async function capture(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => {
          const bounds = image.getBoundingClientRect();
          return bounds.width > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight;
        })
        .map((image) => image.decode().catch(() => {})),
    );
  });
  const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  const webp = await sharp(screenshot).webp({ quality: 80 }).toBuffer();
  if (webp.length > maxBytes) throw new Error(`${name}.webp exceeds ${maxBytes} bytes`);
  return [name, webp];
}

async function openDemoAccount(email) {
  const context = await browser.newContext({
    baseURL: origin.origin,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

try {
  const attendee = await openDemoAccount('tobi@stu.ui.edu.ng');
  await attendee.goto('/explore');
  await expect(attendee.getByRole('region', { name: '24-hour Campus Club Stories' })).toBeVisible(
    wait,
  );
  const feed = await capture(attendee, 'feed');
  await attendee.goto('/e/havana-night-sub-field');
  await attendee.getByRole('button', { name: 'RSVP — Free', exact: true }).click();
  await attendee.getByRole('link', { name: 'Open Offline QR Pass →', exact: true }).click();
  await expect(attendee.getByRole('img', { name: 'Event entry QR code' })).toBeVisible(wait);
  await expect(attendee.getByText('DEMO PASS · Not valid for entry')).toBeVisible(wait);
  const pass = await capture(attendee, 'pass');

  const organizer = await openDemoAccount('organizer@campus.test');
  await organizer.goto('/organizer/sigma-club-ui');
  await expect(organizer.getByRole('heading', { name: 'Sigma Club UI', exact: true })).toBeVisible(
    wait,
  );
  const dashboard = await capture(organizer, 'organizer');
  await organizer.goto('/organizer/door/demo-sigma-live');
  await organizer.getByRole('button', { name: 'Sync demo roster' }).click();
  await expect(organizer.getByText('Demo roster ready on this device')).toBeVisible({
    timeout: 30_000,
  });
  await organizer.getByRole('tab', { name: 'Manual Check-In' }).click();
  await expect(organizer.getByLabel('Find an attendee')).toBeVisible(wait);
  const door = await capture(organizer, 'door');

  await mkdir(output, { recursive: true });
  await Promise.all(
    [feed, pass, dashboard, door].map(([name, webp]) =>
      writeDemoWebp(new URL(name + '.webp', output), webp),
    ),
  );
} finally {
  await browser.close();
}
