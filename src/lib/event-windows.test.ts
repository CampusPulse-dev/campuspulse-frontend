import { describe, expect, it } from 'vitest';
import { isThisWeek, isTonight, tonightEndsAt } from './campus-data';

// All instants are UTC; WAT is UTC+1.
const at = (iso: string) => Date.parse(iso);

describe('Tonight window (WAT)', () => {
  it('keeps an event that is already running at 9 PM', () => {
    const now = at('2026-11-06T20:00:00Z'); // 9 PM WAT
    const party = { startsAt: '2026-11-06T19:00:00Z', endsAt: '2026-11-06T23:00:00Z' };
    expect(isTonight(party, now)).toBe(true);
  });

  it('shows the evening line-up when checked at 11 AM', () => {
    const now = at('2026-11-06T10:00:00Z'); // 11 AM WAT
    const evening = { startsAt: '2026-11-06T20:00:00Z' }; // 9 PM WAT
    expect(isTonight(evening, now)).toBe(true);
  });

  it('includes a 1 AM start after midnight but not the next evening', () => {
    const now = at('2026-11-06T20:00:00Z'); // 9 PM WAT Friday
    expect(isTonight({ startsAt: '2026-11-07T00:00:00Z' }, now)).toBe(true); // 1 AM WAT
    expect(isTonight({ startsAt: '2026-11-07T18:00:00Z' }, now)).toBe(false); // 7 PM Sat
  });

  it('treats 2 AM as still part of last night', () => {
    const now = at('2026-11-07T01:00:00Z'); // 2 AM WAT Saturday
    expect(tonightEndsAt(now)).toBe(at('2026-11-07T05:00:00Z')); // 6 AM WAT Saturday
  });

  it('drops events that have ended', () => {
    const now = at('2026-11-06T22:00:00Z');
    const over = { startsAt: '2026-11-06T17:00:00Z', endsAt: '2026-11-06T19:00:00Z' };
    expect(isTonight(over, now)).toBe(false);
    expect(isThisWeek(over, now)).toBe(false);
  });

  it('assumes a four-hour run when there is no end time', () => {
    const now = at('2026-11-06T22:00:00Z');
    expect(isTonight({ startsAt: '2026-11-06T19:00:00Z' }, now)).toBe(true);
    expect(isTonight({ startsAt: '2026-11-06T17:00:00Z' }, now)).toBe(false);
  });
});
