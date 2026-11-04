import { expect, test } from '@playwright/test';
test('signed-out home introduces CampusPulse and discovery stays public', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /If it’s happening/ })).toBeVisible();
  await page.getByRole('link', { name: 'Explore tonight’s events' }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading', { name: 'Upcoming events', exact: true })).toBeVisible();
  await page
    .getByRole('link', { name: 'Search events and clubs', exact: true })
    .or(page.getByRole('link', { name: 'Search', exact: true }))
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel('Search campus', { exact: true })).toBeVisible();
});
test('landing and event content is server rendered without JavaScript', async ({
  browser,
  baseURL,
}) => {
  test.skip(process.env.NEXT_PUBLIC_DEMO_MODE !== 'true', 'Uses demo event fixtures.');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL! + '/');
  await expect(page.getByRole('heading', { level: 1, name: /If it’s happening/ })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(4);
  await page.goto(baseURL! + '/e/havana-night-sub-field');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sigma Havana Night: Neon Pulse Edition' }),
  ).toBeVisible();
  await expect(
    page.getByText('SUB Main Field, University of Ibadan', { exact: true }),
  ).toBeVisible();
  await context.close();
});
