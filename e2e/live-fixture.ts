import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { offlineProxy } from './offline-proxy';
export { expect };
export type Scenario = {
  runId: string;
  organizerId: string;
  organizerSlug: string;
  organizerName: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  venueName: string;
  rsvpId: string;
  qrToken: string;
  verificationId: string | null;
  attendeeName: string;
  selectedName: string;
  cookie: string;
  password: string;
  email: string;
  users: { id: string; email: string; name: string; token: string }[];
};
export const API = process.env.LIVE_API_URL ?? 'http://localhost:3001';
export const test = base.extend<{ scenario: Scenario }>({
  scenario: async ({}, provideScenario, info) => {
    const cases = JSON.parse(
      readFileSync(
        resolve(
          process.env.LIVE_FIXTURES ?? '../campuspulse-backend/test-results/browser-fixtures.json',
        ),
        'utf8',
      ),
    ) as Record<string, Scenario[]>;
    const number = Number(/^L(\d+)/.exec(info.title)?.[1]);
    const scenario = cases[info.project.name]?.[number - 1];
    if (!scenario) throw new Error(`Missing isolated fixture for ${info.project.name} L${number}`);
    await provideScenario(scenario);
  },
});
export async function authenticate(context: BrowserContext, scenario: Scenario) {
  await context.addCookies([
    {
      name: 'cp_refresh',
      value: scenario.cookie,
      domain: 'localhost',
      path: '/api/v1/auth',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
    {
      name: 'cp_signed_in',
      value: '1',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}
export const authorization = (s: Scenario, role = 1) => ({
  Authorization: `Bearer ${s.users[role]!.token}`,
});
export async function signIn(page: Page, scenario: Scenario) {
  await page.goto('/sign-in');
  await page.getByLabel('Student or Personal Email').fill(scenario.email);
  await page.getByLabel('Password', { exact: true }).fill(scenario.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}
export async function offlineJourney(page: Page, browserName: string, baseURL: string) {
  const proxy = browserName === 'webkit' ? await offlineProxy(baseURL) : null;
  if (proxy) await page.goto(proxy.origin);
  return {
    origin: proxy?.origin ?? baseURL,
    async offline() {
      if (proxy) {
        await page.context().route(`${API}/**`, (route) => route.abort());
        await page.addInitScript(() =>
          Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }),
        );
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
          window.dispatchEvent(new Event('offline'));
        });
        proxy.block();
      } else await page.context().setOffline(true);
    },
    async online() {
      proxy?.unblock();
      await page.context().unroute(`${API}/**`);
      await page.context().setOffline(false);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
        window.dispatchEvent(new Event('online'));
      });
    },
    async close() {
      await proxy?.close();
    },
  };
}
