import { expect, test } from '@playwright/test';

test('home page renders for a signed-out visitor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CampusPulse' })).toBeVisible();
});
