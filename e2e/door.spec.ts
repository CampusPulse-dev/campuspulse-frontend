import { expect, test, type Page } from '@playwright/test';
import { offlineProxy } from './offline-proxy';

test.skip(process.env.NEXT_PUBLIC_DEMO_MODE !== 'true', 'Requires demo mode.');

async function signIn(page: Page, origin: string, email: string) {
  await page.goto(`${origin}/sign-in`);
  await page.getByLabel('Student or Personal Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('the scanner verifies its signed sample on this browser', async ({ page, baseURL }) => {
  await signIn(page, baseURL!, 'organizer@campus.test');
  await page.goto('/organizer/door/demo-sigma-live');
  await page.getByRole('button', { name: 'Sync demo roster' }).click();
  await expect(page.getByText('Demo roster ready on this device')).toBeVisible({ timeout: 30000 });
  await page.getByText('Try a demo pass').click();
  await page.getByRole('button', { name: 'Scan sample pass' }).click();
  await expect(page.getByText('DEMO VALID')).toBeVisible();
});

test('demo door scans, catches duplicates, and keeps manual check-in available offline', async ({
  page,
  context,
  browserName,
  baseURL,
}) => {
  const proxy = browserName === 'webkit' ? await offlineProxy(baseURL!) : null;
  const origin = proxy?.origin ?? baseURL!;
  try {
    await signIn(page, origin, 'organizer@campus.test');
    await page.goto(`${origin}/organizer/door/demo-sigma-live`);
    await expect(page.getByRole('tab', { name: 'QR Scanner' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Manual Check-In' })).toBeVisible();
    await page.getByRole('button', { name: 'Sync demo roster' }).click();
    await expect(page.getByText('Demo roster ready on this device')).toBeVisible({
      timeout: 30000,
    });
    await page.getByText('Try a demo pass').click();
    await page.getByRole('button', { name: 'Scan sample pass' }).click();
    await expect(page.getByText('DEMO VALID')).toBeVisible();
    await page.getByRole('button', { name: 'Scan sample pass' }).click();
    await expect(page.getByText('DUPLICATE', { exact: true })).toBeVisible();
    if (proxy) proxy.block();
    else await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Demo roster ready on this device')).toBeVisible();
    await page.getByRole('tab', { name: 'Manual Check-In' }).click();
    await page.getByLabel('Find an attendee').fill('02');
    await page.getByRole('button', { name: 'Check in Demo Attendee 002' }).click();
    await expect(page.getByText('Demo check-in recorded · Demo Attendee 002')).toBeVisible();
    if (proxy) proxy.unblock();
    else await context.setOffline(false);
  } finally {
    await proxy?.close();
  }
});

test('door staff access is restricted to the granted event and has no organizer navigation', async ({
  page,
  baseURL,
}) => {
  await signIn(page, baseURL!, 'emeka.okafor@stu.ui.edu.ng');
  await page.goto('/organizer/door/demo-sigma-live');
  await expect(
    page.getByRole('heading', { name: 'Sigma Havana Night: Neon Pulse Edition' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: /Organizer/ })).toHaveCount(0);
  await page.goto('/organizer/door/demo-sports-live');
  await expect(page.getByRole('heading', { name: 'Door access unavailable' })).toBeVisible();
});
