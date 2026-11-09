import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.skip(
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true',
  'Run against an explicitly built demo with NEXT_PUBLIC_DEMO_MODE=true.',
);

async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Student or Personal Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CampusPulse2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
}

async function fillEventBasics(page: Page, title: string) {
  await page.getByRole('button', { name: /Concert \/ Party/ }).click();
  await page.getByLabel('Category').selectOption('SOCIAL_PARTY');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description').fill('A big night out on campus.');
  await page.getByLabel('Starts (WAT)').fill('2030-11-20T19:00');
  await page.getByLabel('Ends (WAT)').fill('2030-11-20T23:00');
  await page.getByLabel('Venue name').fill('SUB Main Field');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Lineup' })).toBeVisible();
}

test('signed-out visitors are asked to sign in', async ({ page }) => {
  await page.goto('/organizer/sigma-club-ui');
  await expect(page.getByRole('heading', { name: 'Sign in to manage your club' })).toBeVisible();
});

test('application stays on this device and can be revisited', async ({ page }) => {
  await signIn(page, 'tobi@stu.ui.edu.ng');
  await page.goto('/organizer/apply');
  await page.getByLabel('Club name').fill('Campus Chess Club');
  await page.getByLabel('About your club').fill('A place to play chess.');
  await page.getByLabel('Club verification evidence').fill('Registered student association');
  await page.getByRole('button', { name: 'Save demo application' }).click();
  await expect(page.getByRole('heading', { name: 'Pending review (demo)' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Campus Chess Club')).toBeVisible();
  await expect(page.getByText('No real review is taking place.')).toBeVisible();
});

test('creator can generate a demo link and see demo counts', async ({ page }) => {
  await signIn(page, 'tobi@stu.ui.edu.ng');
  await page.goto('/settings/creator');
  await page.getByRole('button', { name: 'Generate demo link' }).click();
  await expect(page.getByLabel('Your demo link')).toHaveValue(/\/e\/.+\?ref=/);
  await expect(page.getByText('Demo attributed RSVPs: 0 · Demo check-ins: 0')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your demo link')).toHaveValue(/\?ref=/);
});

test('saved drafts reopen and publish without a duplicate', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/sigma-club-ui/events/new');
  await fillEventBasics(page, 'Editable Night');
  await page.getByRole('button', { name: 'Add performer' }).click();
  await page.getByLabel('Performer 1').fill('DJ Test');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await page.getByRole('link', { name: 'Editable Night' }).click();
  await expect(page.getByRole('heading', { name: 'Edit draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Editable Night');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Performer 1')).toHaveValue('DJ Test');
  await page.getByRole('button', { name: 'Publish Now' }).click();
  await expect(page.getByRole('heading', { name: 'Event published' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Editable Night' })).toHaveCount(1);
});

test('attendees cannot open a club dashboard', async ({ page }) => {
  await signIn(page, 'tobi@stu.ui.edu.ng');
  await page.goto('/organizer/sigma-club-ui');
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this club' }),
  ).toBeVisible();
});

test('a verified club owner can create a draft and publish an event', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer');
  await page.getByRole('link', { name: 'Open dashboard' }).first().click();

  await expect(page.getByRole('heading', { name: 'Sigma Club UI', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live / Today' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Door Scanner' })).toBeVisible();
  await expect(page.getByLabel('Club verification status')).toHaveCount(0);

  await page.getByRole('main').getByRole('link', { name: 'New event' }).click();
  await fillEventBasics(page, 'Playwright Draft Night');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft saved' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByText('Playwright Draft Night')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drafts' })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'New event' }).click();
  await fillEventBasics(page, 'Playwright Live Night');
  await page.getByRole('button', { name: 'Add performer' }).click();
  await page.getByLabel('Performer 1').fill('DJ Test');
  await page.getByRole('button', { name: 'Publish Now' }).click();
  await expect(page.getByRole('heading', { name: 'Event published' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
  await expect(page.getByText('Playwright Live Night')).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('organizer-dashboard.png'),
    fullPage: true,
  });
});

test('an unverified club sees its review status and cannot publish', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/ui-film-society');
  await expect(page.getByRole('heading', { name: 'More info requested' })).toBeVisible();
  await expect(page.getByText(/signed approval letter/)).toBeVisible();

  await page.goto('/organizer/ui-film-society/events/new');
  await fillEventBasics(page, 'Film Night');
  await expect(page.getByRole('button', { name: 'Publish Now' })).toBeDisabled();
  await expect(page.getByText(/Publishing unlocks once your club is verified/)).toBeVisible();
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft saved' })).toBeVisible();
});

test('a manager updates a live match score and exports the attendee list', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/ui-sports-council');
  await page.getByRole('link', { name: 'Inter-Hall Football Final: Mellanby vs Tedder' }).click();

  const stats = page.getByLabel('Event stats');
  await expect(stats.getByText('614 / 800')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live score' })).toBeVisible();

  await page.getByLabel('Home score').fill('3');
  await page.getByLabel('Period label').fill("LIVE · 80'");
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.getByText('Score saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Home score')).toHaveValue('3');
  await expect(page.getByLabel('Period label')).toHaveValue("LIVE · 80'");

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export attendee CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mellanby-vs-tedder-interhall-final-attendees.csv');
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.startsWith('Attendee,RSVP status,Checked in\r\n')).toBe(true);
  expect(csv).toContain('Demo Attendee 001,CONFIRMED,Yes');
});

test('a verified club posts and deletes a 24h story', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/sigma-club-ui/stories/new');
  await expect(page.getByRole('heading', { name: 'New story' })).toBeVisible();
  await expect(page.getByText('No active stories right now.')).toBeVisible();

  await page.getByLabel('Photo or video').setInputFiles({
    name: 'flyer.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await expect(page.getByAltText('Story preview')).toBeVisible();
  await page.getByLabel('Caption').fill('Doors open at 7 PM');
  await page
    .getByLabel('Link to an event (optional)')
    .selectOption({ label: 'Sigma Havana Night: Neon Pulse Edition' });
  await page.getByRole('button', { name: 'Post story' }).click();
  await expect(page.getByText('Story posted. It will disappear in 24 hours.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Doors open at 7 PM' })).toBeVisible();
  await expect(page.getByText(/Expires in 24h/)).toBeVisible();

  await page.goto('/organizer/sigma-club-ui');
  await expect(page.getByText('Active stories')).toBeVisible();

  await page.goto('/organizer/sigma-club-ui/stories/new');
  await page.getByRole('button', { name: 'Delete story 1' }).click();
  await page.getByRole('button', { name: 'Delete story', exact: true }).click();
  await expect(page.getByText('No active stories right now.')).toBeVisible();
});

test('an unverified club cannot post stories', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/ui-film-society/stories/new');
  await expect(page.getByText(/unlocks once your club is verified/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post story' })).toBeDisabled();
});

test('a club owner manages managers and door staff', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/sigma-club-ui');
  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible();
  await expect(page.getByText('Club owner (you)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Adaeze Obi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Emeka Okafor' })).toBeVisible();

  await page.getByLabel('Manager email').fill('nope');
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  await page.getByLabel('Manager email').fill('tobi.adeyemi@stu.ui.edu.ng');
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByText(/Invite sent/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tobi Adeyemi' })).toBeVisible();
  await expect(page.getByText('t***@stu.ui.edu.ng')).toBeVisible();
  await expect(page.getByText('tobi.adeyemi@stu.ui.edu.ng')).toHaveCount(0);

  await page.getByRole('button', { name: 'Remove Adaeze Obi' }).click();
  await page.getByRole('button', { name: 'Remove from team' }).click();
  await expect(page.getByRole('heading', { name: 'Adaeze Obi' })).toHaveCount(0);

  await page.getByLabel('Event', { exact: true }).selectOption({ label: 'Sigma Chief Dinner' });
  await page.getByLabel('Door staff email').fill('volunteer@stu.ui.edu.ng');
  await page.getByRole('button', { name: 'Grant door access' }).click();
  await expect(page.getByText(/Door access granted/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Volunteer' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tobi Adeyemi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Volunteer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Adaeze Obi' })).toHaveCount(0);
});

test('a manager cannot see or open team management', async ({ page }) => {
  await signIn(page, 'organizer@campus.test');
  await page.goto('/organizer/ui-sports-council');
  await expect(page.getByRole('link', { name: 'New event' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team' })).toHaveCount(0);

  await page.goto('/organizer/ui-sports-council/team');
  await expect(page.getByText('Only the club owner can manage the team.')).toBeVisible();
  await expect(page.getByLabel('Manager email')).toHaveCount(0);
});
