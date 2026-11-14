import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), publishSaved: vi.fn(), oldPublish: vi.fn() }));
vi.mock('@/lib/mode', () => ({ DEMO_MODE: false }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('./OrganizerGate', () => ({
  ClubGate: ({ children }: { children: () => React.ReactNode }) => children(),
}));
vi.mock('@/lib/organizer-live', () => ({
  liveReadDraft: vi.fn(),
  livePublishSaved: mocks.publishSaved,
}));
vi.mock('@/lib/organizer-data', () => ({
  fetchOrganizerDashboard: () =>
    Promise.resolve({
      organizer: { name: 'Synthetic club' },
      events: [],
      verification: { status: 'VERIFIED' },
    }),
  saveEventDraft: mocks.save,
  publishEvent: mocks.oldPublish,
}));
vi.mock('./EventWizard', () => ({
  EventWizard: ({ onPublish }: { onPublish: (draft: unknown) => Promise<void> }) => (
    <button
      onClick={() => {
        void onPublish({ title: 'Synthetic event' }).catch(() => {});
      }}
    >
      Publish test event
    </button>
  ),
}));
import { NewEvent } from './NewEvent';
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('publishes an already-saved event and retries its ID without saving or uploading again', async () => {
  mocks.save.mockResolvedValue({ id: 'saved-event' });
  mocks.publishSaved
    .mockRejectedValueOnce(new Error('Temporary publish failure'))
    .mockResolvedValueOnce({ id: 'saved-event' });
  const view = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NewEvent slug="synthetic" />
    </QueryClientProvider>,
  );
  const button = await view.findByRole('button', { name: 'Publish test event' });
  fireEvent.click(button);
  await waitFor(() => expect(mocks.publishSaved).toHaveBeenCalledTimes(1));
  fireEvent.click(button);
  await view.findByRole('heading', { name: 'Event published' });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.publishSaved.mock.calls).toEqual([['saved-event'], ['saved-event']]);
  expect(mocks.oldPublish).not.toHaveBeenCalled();
});
