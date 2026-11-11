import { expect, test, type Page } from '@playwright/test';

test.skip(
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true',
  'Run against an explicitly built demo with NEXT_PUBLIC_DEMO_MODE=true.',
);

// Demo mode picks the persona from the email prefix (see demoRoleForEmail).
async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Student or Personal Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
}

test('signed-out visitors are sent to sign in before anything renders', async ({ page }) => {
  await page.goto('/admin/verifications/students');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fverifications%2Fstudents/);
});

test('students cannot open the admin portal', async ({ page }) => {
  await signIn(page, 'tobi@stu.ui.edu.ng');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
});

test('a verifier never sees the student ID queue', async ({ page }) => {
  await signIn(page, 'verifier@campuspulse.ng');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Student IDs/ })).toHaveCount(0);
  await page.goto('/admin/verifications/students');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Verifier');
  await expect(page.getByRole('button', { name: 'Claim to review' })).toHaveCount(0);
});

test('super admin claims, views the ID, approves, and the audit log shows it', async ({ page }) => {
  await signIn(page, 'super.admin@campuspulse.ng');
  await page.goto('/admin/verifications/students');
  await expect(page.getByRole('heading', { name: 'Student IDs', level: 1 })).toBeVisible();

  // Nothing can be decided, and no image is offered, before the claim.
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'View ID image' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Claim to review' }).click();
  await expect(page.getByText(/You hold this request/)).toBeVisible();

  await page.getByRole('button', { name: 'View ID image' }).click();
  await expect(page.getByRole('img', { name: 'Student ID image, watermarked' })).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The ID image is deleted the moment you confirm');
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Student ID image, watermarked' })).toHaveCount(0);

  await page.goto('/admin/audit');
  await expect(page.getByRole('cell', { name: 'verification.approved' }).first()).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'verification.document.viewed' }).first(),
  ).toBeVisible();
});

test('rejecting needs a note', async ({ page }) => {
  await signIn(page, 'verifier@campuspulse.ng');
  await page.goto('/admin/verifications/organizers');
  await page.getByRole('button', { name: 'Claim to review' }).click();
  await page.getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog.getByText(/Write a note/)).toBeVisible();
  await dialog
    .getByLabel('Why is this rejected?')
    .fill('The evidence link does not name this club.');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toHaveCount(0);
});
