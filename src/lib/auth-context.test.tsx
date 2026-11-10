import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';
vi.mock('./mode', () => ({ DEMO_MODE: false, DEV_AUTH_MODE: false, DATA_MODE: 'live' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
function Probe() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.ready ? (auth.user?.displayName ?? 'signed out') : 'loading'}</span>
      <button
        onClick={() => {
          void auth
            .signIn({ email: 'student@stu.ui.edu.ng', password: 'longpassword' })
            .catch(() => {});
        }}
      >
        Authenticate
      </button>
    </>
  );
}
it('does not sign users in or verify them when live authentication fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Service unavailable')));
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await view.findByText('signed out');
  fireEvent.click(view.getByRole('button', { name: 'Authenticate' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(view.getByText('signed out')).toBeDefined();
  expect(localStorage.getItem('live:user')).toBe('null');
});
