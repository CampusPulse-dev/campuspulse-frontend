import { afterEach, expect, it, vi } from 'vitest';
import { fetchEventFeed, fetchEventBySlug } from './api';
import { safeNext } from './mode';
vi.mock('./mode', async (original) => ({
  ...(await original()),
  DEMO_MODE: false,
}));
afterEach(() => vi.unstubAllGlobals());
it('propagates live feed and event errors instead of using demo data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(fetchEventFeed()).rejects.toThrow('offline');
  await expect(fetchEventBySlug('havana-night-sub-field')).rejects.toThrow('offline');
});
it('restricts auth return targets to local paths', () => {
  expect(safeNext('https://evil.test')).toBe('/');
  expect(safeNext('//evil.test')).toBe('/');
  expect(safeNext('/\\evil.test')).toBe('/');
  expect(safeNext('/e/event?ref=abc')).toBe('/e/event?ref=abc');
});
