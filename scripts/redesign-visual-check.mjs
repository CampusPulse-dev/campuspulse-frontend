import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const origin = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const output = path.resolve('test-results/redesign');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const measurements = [];
page.on('pageerror', (error) => errors.push(error.message));

async function snapshot(route, name) {
  for (const width of [375, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(output, `${name}-${width}-${theme}.png`),
        fullPage: true,
      });
      measurements.push(
        await page.evaluate(
          ({ route, width, theme }) => {
            const visible = (el) =>
              el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
            const tinyText = [...document.querySelectorAll('body *')]
              .filter(
                (el) =>
                  visible(el) &&
                  [...el.childNodes].some(
                    (node) => node.nodeType === 3 && node.textContent.trim(),
                  ) &&
                  parseFloat(getComputedStyle(el).fontSize) < 12,
              )
              .map((el) => el.textContent.slice(0, 80));
            const smallTargets = [
              ...document.querySelectorAll('a,button,input,select,textarea,summary'),
            ]
              .filter((el) => visible(el) && !el.closest('[aria-hidden="true"]'))
              .filter((el) => {
                const rect = el.getBoundingClientRect();
                return rect.width < 43.5 || rect.height < 43.5;
              })
              .map((el) => ({
                label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 70),
                width: Math.round(el.getBoundingClientRect().width),
                height: Math.round(el.getBoundingClientRect().height),
              }));
            return {
              route,
              width,
              theme,
              h1: document.querySelectorAll('h1').length,
              overflow: document.documentElement.scrollWidth > width,
              tinyText,
              smallTargets,
              displayFont: getComputedStyle(document.querySelector('h1')).fontFamily,
            };
          },
          { route, width, theme },
        ),
      );
    }
  }
}

async function signIn(email) {
  await page.goto(origin + '/sign-in');
  await page.getByLabel('Student or Personal Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(origin + '/');
  await page.getByRole('heading', { name: 'Find your next plan.' }).waitFor();
}

try {
  await snapshot('/', 'landing');
  await snapshot('/explore', 'explore');
  await snapshot('/e/havana-night-sub-field', 'event');
  await signIn('tobi@stu.ui.edu.ng');
  await snapshot('/settings', 'settings');
  await page.goto(origin + '/e/havana-night-sub-field');
  await page.getByRole('button', { name: 'RSVP — Free', exact: true }).click();
  const passHref = await page
    .getByRole('link', { name: 'Open Offline QR Pass →', exact: true })
    .getAttribute('href');
  await page.getByRole('link', { name: 'Open Offline QR Pass →', exact: true }).click();
  await page.getByRole('img', { name: 'Event entry QR code' }).waitFor();
  await snapshot(passHref, 'pass');
  await page.goto(origin + '/settings');
  await page.getByRole('button', { name: 'Sign out and clear cached tickets' }).click();
  await page.getByRole('link', { name: 'Sign in →', exact: true }).waitFor();
  await signIn('organizer@campus.test');
  await snapshot('/organizer/sigma-club-ui', 'organizer');
  await snapshot('/organizer/door/demo-sigma-live', 'door');
  await page.getByRole('button', { name: 'Sync demo roster' }).click();
  await page.getByText('Demo roster ready on this device').waitFor();
  const qrTab = page.getByRole('tab', { name: 'QR Scanner', exact: true });
  await qrTab.focus();
  await page.keyboard.press('ArrowRight');
  if (
    (await page
      .getByRole('tab', { name: 'Manual Check-In', exact: true })
      .getAttribute('aria-selected')) !== 'true'
  )
    throw new Error('Door keyboard tab change failed.');
  await page.getByLabel('Find an attendee').waitFor();
  const report = {
    measurements,
    errors,
    files: fs.readdirSync(output).filter((name) => name.endsWith('.png')),
  };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report));
  if (
    errors.length ||
    measurements.some(
      (row) => row.overflow || row.tinyText.length || row.smallTargets.length || row.h1 !== 1,
    )
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
