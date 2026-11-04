import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Badge, CategoryPill } from './Badge';
import { Avatar, FriendAvatarStack } from './Avatar';
import { Modal } from './Modal';
import { Tabs } from './Tabs';

afterEach(() => {
  cleanup();
});

describe('UI Primitives (S4-01)', () => {
  it('renders Button with loading state and disables clicks while loading', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button isLoading onClick={onClick}>
        Lock in RSVP
      </Button>,
    );
    const btn = getByRole('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders CategoryPill for all 5 PRD event categories with human labels', () => {
    const { getByText, rerender } = render(<CategoryPill category="SOCIAL_PARTY" />);
    expect(getByText('Social / Party')).toBeDefined();

    rerender(<CategoryPill category="PERFORMANCE_ARTS" />);
    expect(getByText('Performance / Arts')).toBeDefined();

    rerender(<CategoryPill category="ACADEMIC_CONFERENCE" />);
    expect(getByText('Academic')).toBeDefined();

    rerender(<CategoryPill category="SPORTS_RECREATION" />);
    expect(getByText('Sports')).toBeDefined();

    rerender(<CategoryPill category="CLUB_SOCIETY" />);
    expect(getByText('Club / Society')).toBeDefined();
  });

  it('renders Badge semantic variants', () => {
    const { getByText } = render(<Badge variant="verified">Verified Club</Badge>);
    expect(getByText('Verified Club')).toBeDefined();
  });

  it('renders Avatar fallback initials and FriendAvatarStack mutual summary', () => {
    const { getByText } = render(
      <div>
        <Avatar name="Tobi Adeyemi" isVerified />
        <FriendAvatarStack
          friends={[
            { id: '1', displayName: 'Adaeze Obi', avatarUrl: null },
            { id: '2', displayName: 'Kunle Bello', avatarUrl: null },
          ]}
          totalCount={5}
        />
      </div>,
    );
    expect(getByText('TA')).toBeDefined();
    expect(getByText(/Adaeze, Kunle \+3 friends going/i)).toBeDefined();
  });

  it('closes Modal when Escape key is pressed', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <Modal isOpen title="Confirm RSVP" onClose={onClose}>
        <p>Sheet content</p>
      </Modal>,
    );
    expect(getByRole('dialog')).toBeDefined();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches active tab when clicked', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Tabs
        tabs={[
          { id: 'upcoming', label: 'Upcoming', count: 2 },
          { id: 'past', label: 'Past' },
        ]}
        activeId="upcoming"
        onChange={onChange}
      />,
    );
    const pastTab = getByRole('tab', { name: /Past/i }) as HTMLButtonElement;
    pastTab.click();
    expect(onChange).toHaveBeenCalledWith('past');
  });
});

it('connects arrow-key tabs to their real panel', () => {
  const change = vi.fn();
  const view = render(
    <Tabs
      tabs={[
        { id: 'qr', label: 'QR Scanner' },
        { id: 'manual', label: 'Manual Check-In' },
      ]}
      activeId="qr"
      onChange={change}
    >
      <p>Scanner content</p>
    </Tabs>,
  );
  const qr = view.getByRole('tab', { name: 'QR Scanner' });
  const manual = view.getByRole('tab', { name: 'Manual Check-In' });
  expect(qr.getAttribute('aria-controls')).toBe(view.getByRole('tabpanel').id);
  qr.focus();
  fireEvent.keyDown(qr, { key: 'ArrowRight' });
  expect(change).toHaveBeenCalledWith('manual');
  expect(document.activeElement).toBe(manual);
  fireEvent.keyDown(manual, { key: 'Home' });
  expect(document.activeElement).toBe(qr);
  fireEvent.keyDown(qr, { key: 'End' });
  expect(document.activeElement).toBe(manual);
});
