import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/mode', () => ({ DEMO_MODE: true, DATA_MODE: 'demo' }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ready: true, user: { id: 'creator' } }),
}));

import { CreatorDashboard } from './CreatorDashboard';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('generates a persistent demo link with explicitly simulated counts', () => {
  const view = render(<CreatorDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate demo link' }));
  expect(screen.getByText('Demo attributed RSVPs: 0 · Demo check-ins: 0')).toBeDefined();
  const link = (screen.getByLabelText('Your demo link') as HTMLInputElement).value;
  expect(link).toContain('?ref=');
  view.unmount();
  render(<CreatorDashboard />);
  expect((screen.getByLabelText('Your demo link') as HTMLInputElement).value).toBe(link);
});
