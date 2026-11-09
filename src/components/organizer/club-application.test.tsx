import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/mode', () => ({ DEMO_MODE: true, DATA_MODE: 'demo' }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ready: true, user: { id: 'test-user' } }),
}));

import { ClubApplication } from './ClubApplication';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('saves the demo application locally and shows its review limitation after reopening', () => {
  const view = render(<ClubApplication />);
  fireEvent.change(screen.getByLabelText('Club name'), { target: { value: 'Chess Club' } });
  fireEvent.change(screen.getByLabelText('About your club'), {
    target: { value: 'Chess on campus' },
  });
  fireEvent.change(screen.getByLabelText('Club verification evidence'), {
    target: { value: 'Student association' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save demo application' }));
  view.unmount();
  render(<ClubApplication />);
  expect(screen.getByRole('heading', { name: 'Pending review (demo)' })).toBeDefined();
  expect(screen.getByText('No real review is taking place.')).toBeDefined();
});
