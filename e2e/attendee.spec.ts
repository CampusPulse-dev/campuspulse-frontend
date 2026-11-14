import { offlineProxy } from './offline-proxy';
import { expect, test, type Page } from '@playwright/test';
test.skip(
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true',
  'Run against an explicitly built demo with NEXT_PUBLIC_DEMO_MODE=true.',
);
async function signIn(page: Page, origin = '') {
  await page.goto(origin + '/sign-in');
  await page.getByLabel('Student or Personal Email').fill('tobi@stu.ui.edu.ng');
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
}
test('signed-out public event is rendered in HTML and requires sign-in for RSVP', async ({
  page,
  request,
}) => {
  const response = await request.get('/e/havana-night-sub-field');
  const html = await response.text();
  expect(html).toContain('Sigma Havana Night');
  expect(html).toContain('og:title');
  await page.goto('/e/havana-night-sub-field');
  await expect(
    page.getByRole('heading', { name: 'Sigma Havana Night: Neon Pulse Edition', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to RSVP', exact: true })).toBeVisible();
});
test('demo RSVP produces a labelled QR pass that survives a full offline reload', async ({
  page,
  context,
  browserName,
  baseURL,
}) => {
  const proxy = browserName === 'webkit' ? await offlineProxy(baseURL!) : null;
  const origin = proxy?.origin ?? baseURL!;
  try {
    await signIn(page, origin);
    await page.goto(origin + '/e/havana-night-sub-field');
    await page.getByRole('button', { name: 'RSVP — Free', exact: true }).click();
    await page.getByRole('link', { name: 'Open Offline QR Pass →', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Event entry QR code' })).toBeVisible();
    await expect(page.getByText('DEMO PASS · Not valid for entry')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('wallet.png'), fullPage: true });
    await expect(page.getByText('Available offline on this device')).toBeVisible({
      timeout: 30000,
    });
    if (proxy) proxy.block();
    else await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('img', { name: 'Event entry QR code' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Sigma Havana Night: Neon Pulse Edition', exact: true }),
    ).toBeVisible();
    if (proxy) proxy.unblock();
    else await context.setOffline(false);
    await page.goto(origin + '/settings');
    await page.getByRole('button', { name: 'Sign out and clear cached tickets' }).click();
    await expect(page.getByRole('link', { name: 'Sign in →', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Sign in →', exact: true }).click();
    await page.getByLabel('Student or Personal Email').fill('tobi@stu.ui.edu.ng');
    await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(origin + '/tickets');
    await expect(page.getByText('Your next night starts here')).toBeVisible();
  } finally {
    await proxy?.close();
  }
});
test('attendee destinations, search, verification and account preferences work in demo mode', async ({
  page,
}) => {
  await signIn(page);
  for (const route of [
    '/friends',
    '/notifications',
    '/settings',
    '/verify',
    '/tickets',
    '/c/bisola',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Could not load this page')).toHaveCount(0);
  }
  await page.goto('/search');
  await page.getByLabel('Search campus', { exact: true }).fill('Sigma');
  await expect(page.getByRole('link', { name: /Sigma Club UI Verified/ })).toBeVisible();
  await page.goto('/verify');
  await page.getByLabel('Student email', { exact: true }).fill('tobi@stu.ui.edu.ng');
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByLabel('Six-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Status: APPROVED' })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: test.info().outputPath('settings.png'), fullPage: true });
});
