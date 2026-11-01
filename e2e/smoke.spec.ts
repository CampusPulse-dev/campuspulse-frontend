import { expect, test } from '@playwright/test';
test('home discovery is public and has working search navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Upcoming Feed/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search events & verified clubs →' })).toBeVisible();
});
