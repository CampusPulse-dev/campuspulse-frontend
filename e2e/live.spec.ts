import {
  test,
  expect,
  authenticate,
  authorization,
  signIn,
  offlineJourney,
  privateStorageCounts,
  API,
  type Scenario,
} from './live-fixture';
import type { Page } from '@playwright/test';

test.skip(
  process.env.LIVE_E2E !== 'true',
  'Requires the isolated real stack and generated account fixtures.',
);
const image = {
  name: 'synthetic.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC9sAAAAASUVORK5CYII=',
    'base64',
  ),
};
const dashboard = (s: Scenario) => `/organizer/${s.organizerSlug}`;
const hub = (s: Scenario) => `${dashboard(s)}/events/${s.eventId}`;
const door = (s: Scenario) => `/organizer/door/${s.eventId}`;
async function session(page: Page, s: Scenario, path: string) {
  await authenticate(page.context(), s);
  await page.goto(path);
}
async function draft(
  page: Page,
  s: Scenario,
  template: 'CONCERT_PARTY' | 'PLAY_CULTURAL' = 'CONCERT_PARTY',
) {
  await session(page, s, `${dashboard(s)}/events/new`);
  await page
    .getByRole('button', {
      name: template === 'PLAY_CULTURAL' ? /Play \/ Cultural/ : /Concert \/ Party/,
    })
    .click();
  await page
    .getByLabel('Category')
    .selectOption(template === 'PLAY_CULTURAL' ? 'PERFORMANCE_ARTS' : 'SOCIAL_PARTY');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Title', { exact: true }).fill(`Draft ${s.runId}`);
  await page.getByLabel('Description').fill('Synthetic browser publishing acceptance event.');
  await page.getByLabel('Starts (WAT)').fill('2030-11-20T19:00');
  await page.getByLabel('Ends (WAT)').fill('2030-11-20T23:00');
  await page.getByLabel('Venue name').fill(s.venueName);
  await page.locator('#event-cover').setInputFiles(image);
}
async function readyDoor(page: Page, s: Scenario) {
  await page.goto(door(s));
  await page.getByRole('button', { name: 'Download roster', exact: true }).click();
  await expect(page.getByText('Roster ready on this device', { exact: true })).toBeVisible();
}

test('L01 signed-out event is server rendered with OG metadata', async ({
  request,
  scenario: s,
}) => {
  const response = await request.get(`/e/${s.eventSlug}`);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain(s.eventTitle);
  expect(html).toContain('property="og:title"');
  expect(html).not.toContain('DEMO PASS');
});
test('L02 real signup and onboarding lead to RSVP', async ({ page, scenario: s }) => {
  await page.goto(`/sign-up?next=${encodeURIComponent(`/e/${s.eventSlug}`)}`);
  await page.getByLabel('Display Name').fill('Synthetic browser signup');
  await page.getByLabel('Email Address').fill(`signup-${s.runId}@example.test`);
  await page.getByLabel('Password (min. 10 characters)').fill(s.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  // Skipping onboarding follows `next` to the event page; navigating there ourselves
  // races that navigation (WebKit aborts one of them).
  await page.waitForURL(`**/e/${s.eventSlug}`);
  await page.getByRole('button', { name: 'RSVP — Free' }).click();
  await expect(page.getByRole('heading', { name: 'Your RSVP is saved' })).toBeVisible();
});
test('L03 password login restores the server-issued ticket', async ({ page, scenario: s }) => {
  await signIn(page, s);
  await page.goto(`/tickets/${s.rsvpId}`);
  await expect(page.getByRole('img', { name: 'Event entry QR code' })).toBeVisible();
  await expect(page.getByRole('heading', { name: s.eventTitle })).toBeVisible();
});
test('L04 anonymous organizer access requires sign in', async ({ page, scenario: s }) => {
  await page.goto(dashboard(s));
  await expect(page.getByRole('heading', { name: 'Sign in to manage your club' })).toBeVisible();
});
test('L05 attendees cannot manage another organizer', async ({ page, scenario: s }) => {
  await session(page, s, dashboard(s));
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this club' }),
  ).toBeVisible();
});
test('L06 attendees cannot open staff administration', async ({ page, scenario: s }) => {
  await session(page, s, '/admin');
  await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
});
test('L07 event links remain public without a session', async ({ page, scenario: s }) => {
  await page.goto(`/e/${s.eventSlug}`);
  await expect(page.getByRole('heading', { name: s.eventTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to RSVP', exact: true })).toBeVisible();
});
test('L08 organizer application persists through the live API', async ({ page, scenario: s }) => {
  await session(page, s, '/organizer/apply');
  await page.getByLabel('Club name').fill(`Application ${s.runId}`);
  await page.getByLabel('Club link').fill(`application-${s.runId}`);
  await page.getByLabel('Verification evidence URL').fill('https://example.com/synthetic-club');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Application ${s.runId}`, { exact: true })).toBeVisible();
});
test('L09 server ticket survives a complete offline reload', async ({
  page,
  browserName,
  baseURL,
  scenario: s,
}) => {
  await authenticate(page.context(), s);
  const network = await offlineJourney(page, browserName, baseURL!);
  try {
    await page.goto(`${network.origin}/tickets/${s.rsvpId}`);
    await expect(page.getByText('Available offline on this device')).toBeVisible();
    await network.offline();
    await page.reload();
    await expect(page.getByRole('img', { name: 'Event entry QR code' })).toBeVisible();
    await expect(page.getByRole('heading', { name: s.eventTitle })).toBeVisible();
  } finally {
    await network.online().catch(() => {});
    await network.close();
  }
});
test('L10 owner dashboard uses aggregate server data', async ({ page, scenario: s }) => {
  await session(page, s, dashboard(s));
  await expect(page.getByRole('heading', { name: s.organizerName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: s.eventTitle, exact: true })).toBeVisible();
});
test('L11 incomplete live drafts are rejected', async ({ page, scenario: s }) => {
  await session(page, s, `${dashboard(s)}/events/new`);
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft saved' })).toHaveCount(0);
  await expect(page.getByRole('alert').first()).toBeVisible();
});
test('L12 complete drafts upload their cover and reopen server details', async ({
  page,
  scenario: s,
}) => {
  await draft(page, s);
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft saved' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await page.getByRole('link', { name: `Draft ${s.runId}`, exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(`Draft ${s.runId}`);
  await expect(page.getByLabel('Venue name')).toHaveValue(s.venueName);
});
test('L13 template publication saves exactly one event', async ({ page, request, scenario: s }) => {
  await draft(page, s);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Add performer' }).click();
  await page.getByLabel('Performer 1').fill('Synthetic DJ');
  await page.getByLabel('Role 1', { exact: true }).fill('DJ');
  await page.getByRole('button', { name: 'Publish Now' }).click();
  await expect(page.getByRole('heading', { name: 'Event published' })).toBeVisible();
  const events = await request.get(`${API}/api/v1/organizers/${s.organizerId}/managed-events`, {
    headers: authorization(s),
  });
  const body = await events.json();
  expect(body.items.filter((e: { title: string }) => e.title === `Draft ${s.runId}`)).toHaveLength(
    1,
  );
});
test('L14 event hub exposes real RSVP totals and CSV', async ({ page, scenario: s }) => {
  await session(page, s, hub(s));
  await expect(page.getByLabel('Event stats')).toContainText('2');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export attendee CSV' }).click();
  expect((await download).suggestedFilename()).toContain('attendees.csv');
});
test('L15 event cancellation persists and updates public state', async ({
  page,
  request,
  scenario: s,
}) => {
  await session(page, s, hub(s));
  await page.getByLabel('Cancellation reason').fill('Synthetic acceptance cancellation');
  await page.getByRole('button', { name: 'Cancel event and notify attendees' }).click();
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  const event = await request.get(`${API}/api/v1/events/${s.eventSlug}`);
  expect((await event.json()).status).toBe('CANCELLED');
});
test('L16 story media uploads, posts and deletes through storage', async ({
  page,
  scenario: s,
}) => {
  await session(page, s, `${dashboard(s)}/stories/new`);
  await page.getByLabel('Photo or video').setInputFiles(image);
  await page.getByLabel('Caption').fill(`Story ${s.runId}`);
  await page.getByRole('button', { name: 'Post story', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Story ${s.runId}` })).toBeVisible();
  await page.getByRole('button', { name: 'Delete story 1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete story', exact: true }).click();
  await expect(page.getByText('No active stories right now.')).toBeVisible();
});
test('L17 registered managers can be added and removed', async ({ page, scenario: s }) => {
  await session(page, s, `${dashboard(s)}/team`);
  await page.getByLabel('Manager email').fill(s.users[0]!.email);
  await page.getByRole('button', { name: 'Send invite' }).click();
  const remove = page.getByRole('button', { name: `Remove ${s.attendeeName}`, exact: true });
  await expect(remove).toBeVisible();
  await remove.click();
  await page.getByRole('button', { name: 'Remove from team' }).click();
  await expect(remove).toHaveCount(0);
});
test('L18 owner grants event-scoped door access', async ({ page, scenario: s }) => {
  await session(page, s, `${dashboard(s)}/team`);
  await page.getByLabel('Event', { exact: true }).selectOption(s.eventId);
  await page.getByLabel('Door staff email').fill(s.users[0]!.email);
  await page.getByRole('button', { name: 'Grant door access', exact: true }).click();
  await expect(page.getByRole('heading', { name: s.attendeeName, exact: true })).toBeVisible();
});
test('L19 manager can read dashboard but cannot manage team', async ({
  page,
  request,
  scenario: s,
}) => {
  await session(page, s, dashboard(s));
  await expect(page.getByRole('heading', { name: s.organizerName, exact: true })).toBeVisible();
  const result = await request.delete(
    `${API}/api/v1/organizers/${s.organizerId}/team/${s.users[2]!.id}`,
    { headers: authorization(s, 2) },
  );
  expect(result.status()).toBe(403);
});
test('L20 door-only role is denied all management reads', async ({
  page,
  request,
  scenario: s,
}) => {
  await session(page, s, dashboard(s));
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this club' }),
  ).toBeVisible();
  for (const route of [
    `organizers/${s.organizerId}/dashboard`,
    `organizers/${s.organizerId}/managed-events`,
    `events/${s.eventId}/manage`,
  ])
    expect(
      (await request.get(`${API}/api/v1/${route}`, { headers: authorization(s, 3) })).status(),
    ).toBe(403);
});
test('L21 manual door check-in persists offline then reconciles exactly once', async ({
  page,
  request,
  browserName,
  baseURL,
  scenario: s,
}) => {
  await authenticate(page.context(), s);
  const network = await offlineJourney(page, browserName, baseURL!);
  try {
    await page.goto(`${network.origin}${door(s)}`);
    await page.getByRole('button', { name: 'Download roster', exact: true }).click();
    await expect(page.getByText('Roster ready on this device', { exact: true })).toBeVisible();
    await network.offline();
    await page.getByRole('tab', { name: 'Manual Check-In' }).click();
    await page.getByLabel('Find an attendee').fill(s.attendeeName);
    await page.getByRole('button', { name: `Check in ${s.attendeeName}`, exact: true }).click();
    await expect(page.getByText(/1 queued/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(/1 queued/).first()).toBeVisible();
    await network.online();
    await expect
      .poll(async () => {
        const result = await request.get(`${API}/api/v1/attendance/events/${s.eventId}/stats`, {
          headers: authorization(s),
        });
        return (await result.json()).checkInCount;
      })
      .toBe(1);
  } finally {
    await network.online().catch(() => {});
    await network.close();
  }
});
test('L22 camera video scans a real signed ticket and catches duplicates', async ({
  page,
  browserName,
  scenario: s,
}) => {
  await authenticate(page.context(), s);
  await readyDoor(page, s);
  await expect(page.getByRole('tab', { name: 'Manual Check-In' })).toBeVisible();
  if (browserName !== 'chromium') {
    // WebKit automation has no physical/fake video camera; denial must preserve the peer tab.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Start camera' }).click();
    await expect(page.getByRole('tab', { name: 'Manual Check-In' })).toBeEnabled();
    return;
  }
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByText('VALID', { exact: true })).toBeVisible({ timeout: 30000 });
  let feedbackMs = Infinity;
  await expect
    .poll(async () => {
      feedbackMs = await page.evaluate(
        () => performance.getEntriesByName('cp-qr-feedback').at(-1)?.duration ?? Infinity,
      );
      return feedbackMs;
    })
    .toBeLessThan(500);
  await test.info().attach('scan-feedback.json', {
    body: JSON.stringify({ feedbackMs, budgetMs: 500 }),
    contentType: 'application/json',
  });
  await expect(page.getByText('DUPLICATE', { exact: true })).toBeVisible({ timeout: 15000 });
});
test('L23 server rejects tampered and wrong-event tokens', async ({ request, scenario: s }) => {
  const endpoint = `${API}/api/v1/attendance/check-in`;
  const other = await request.post(`${API}/api/v1/events`, {
    headers: authorization(s),
    data: {
      organizerId: s.organizerId,
      title: `Other ${s.runId}`,
      description: 'Synthetic wrong-event ticket acceptance',
      category: 'SOCIAL_PARTY',
      startsAt: '2030-11-20T18:00:00.000Z',
      endsAt: '2030-11-20T22:00:00.000Z',
      venueName: 'Synthetic SUB',
      coverImageUrl: 'https://example.test/cover.png',
    },
  });
  expect(other.status()).toBe(201);
  const otherEvent = await other.json();
  const published = await request.post(`${API}/api/v1/events/${otherEvent.id}/publish`, {
    headers: authorization(s),
  });
  expect(published.ok()).toBe(true);
  const common = { method: 'QR_SCAN', scannedAt: new Date().toISOString() };
  const wrong = await request.post(endpoint, {
    headers: authorization(s),
    data: { ...common, eventId: otherEvent.id, qrToken: s.qrToken },
  });
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).message).toBe('QR token belongs to a different event');
  const result = await request.post(endpoint, {
    headers: authorization(s, 3),
    data: { ...common, eventId: s.eventId, qrToken: s.qrToken.slice(0, -8) + 'tampered' },
  });
  expect(result.status()).toBe(400);
  expect((await result.json()).message).toBe('Invalid QR token signature');
});
test('L24 creator attribution belongs to the authenticated creator', async ({
  page,
  request,
  scenario: s,
}) => {
  const link = await request.post(`${API}/api/v1/attendance/ambassador-links`, {
    headers: authorization(s, 7),
    data: { eventId: s.eventId },
  });
  expect(link.ok()).toBe(true);
  await session(page, s, '/settings/creator');
  await expect(page.getByLabel(`Your link for ${s.eventTitle}`)).toHaveValue(/\?ref=/);
  await expect(page.getByText(/Attributed RSVPs: 0/)).toBeVisible();
});
test('L25 super admin claims views and approves synthetic ID with audit evidence', async ({
  page,
  scenario: s,
}) => {
  await session(page, s, '/admin/verifications/students');
  await page.getByRole('button').filter({ hasText: s.attendeeName }).click();
  await page.getByRole('button', { name: 'Claim to review', exact: true }).click();
  await page.getByRole('button', { name: 'View ID image', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Student ID image, watermarked' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/admin/audit');
  await expect(
    page.getByRole('cell', { name: 'verification.document.viewed', exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'verification.approved', exact: true }).first(),
  ).toBeVisible();
});
test('L26 verifier cannot view student ID documents', async ({ page, request, scenario: s }) => {
  await session(page, s, '/admin');
  // Wait for the signed-in shell (its session refresh has landed) before navigating on.
  await expect(page.getByRole('link', { name: /Clubs & creators/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Student IDs/ })).toHaveCount(0);
  await page.goto('/admin/verifications/students');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Verifier');
  const result = await request.get(`${API}/api/v1/admin/verifications/${s.runId}/document`, {
    headers: authorization(s, 5),
  });
  expect(result.status()).toBe(403);
});
test('L27 moderator can open the live reports queue', async ({ page, scenario: s }) => {
  await session(page, s, '/admin/moderation');
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Open', exact: true })).toBeVisible();
});
test('L28 super admin can open the live audit trail', async ({ page, scenario: s }) => {
  await session(page, s, '/admin/audit');
  await expect(page.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible();
});
test('L29 sign out removes private offline ticket and scanner caches', async ({
  page,
  request,
  scenario: s,
}) => {
  const grant = await request.post(`${API}/api/v1/events/${s.eventId}/door-staff`, {
    headers: authorization(s),
    data: { email: s.email },
  });
  expect(grant.ok()).toBe(true);
  await session(page, s, `/tickets/${s.rsvpId}`);
  await expect(page.getByRole('img', { name: 'Event entry QR code' })).toBeVisible();
  await page.context().route(`${API}/api/v1/attendance/check-in/batch`, (route) => route.abort());
  await readyDoor(page, s);
  await page.getByRole('tab', { name: 'Manual Check-In' }).click();
  await page.getByLabel('Find an attendee').fill(s.attendeeName);
  await page.getByRole('button', { name: `Check in ${s.attendeeName}`, exact: true }).click();
  await expect.poll(async () => (await privateStorageCounts(page)).scans).toBe(1);
  await page.goto('/settings');
  expect(await privateStorageCounts(page)).toEqual({ passes: 1, packs: 1, scans: 1 });
  await page.getByRole('button', { name: 'Sign out and clear cached tickets' }).click();
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === 'cp_refresh'))
    .toBe(false);
  await expect.poll(() => privateStorageCounts(page)).toEqual({ passes: 0, packs: 0, scans: 0 });
  // Let the app finish settling into its signed-out state before navigating, or the
  // navigation races the account-change re-render (WebKit aborts the goto).
  await expect(page.getByRole('heading', { name: 'Your campus, connected' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.goto(`/tickets/${s.rsvpId}`);
  await expect(page.getByRole('img', { name: 'Event entry QR code' })).toHaveCount(0);
});
test('L30 development headers cannot authenticate on the live stack', async ({
  request,
  scenario: s,
}) => {
  const result = await request.get(`${API}/api/v1/organizers/${s.organizerId}/dashboard`, {
    headers: { 'X-Dev-User': s.users[1]!.email },
  });
  expect(result.status()).toBe(401);
});
test('L31 play template publishes WAT showtimes through the live contract', async ({
  page,
  request,
  scenario: s,
}) => {
  await draft(page, s, 'PLAY_CULTURAL');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Add showtime' }).click();
  await page.getByLabel('Showtime label 1').fill('Matinee');
  await page.getByLabel('Showtime starts 1').fill('2030-11-20T20:00');
  await page.getByRole('button', { name: 'Publish Now' }).click();
  await expect(page.getByRole('heading', { name: 'Event published' })).toBeVisible();
  const response = await request.get(`${API}/api/v1/organizers/${s.organizerId}/managed-events`, {
    headers: authorization(s),
  });
  const event = (await response.json()).items.find(
    (row: { title: string }) => row.title === `Draft ${s.runId}`,
  );
  const details = await request.get(`${API}/api/v1/events/${event.id}/manage`, {
    headers: authorization(s),
  });
  expect((await details.json()).draft.showtimes[0].startsAt).toBe('2030-11-20T19:00:00.000Z');
});
