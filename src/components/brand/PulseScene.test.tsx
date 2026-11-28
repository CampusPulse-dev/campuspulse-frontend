import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PulseScene } from './PulseScene';
import { mountPulseScene } from './pulse-scene-engine';

vi.mock('./pulse-scene-engine', () => ({ mountPulseScene: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('lets users pause and resume the decorative motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getClientRects').mockReturnValue({
    length: 1,
  } as DOMRectList);
  const setPaused = vi.fn();
  const dispose = vi.fn();
  vi.mocked(mountPulseScene).mockReturnValue({ setPaused, dispose });

  const { unmount } = render(<PulseScene />);

  fireEvent.click(await screen.findByRole('button', { name: 'Pause animation' }));
  expect(setPaused).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Resume animation' }));
  expect(setPaused).toHaveBeenLastCalledWith(false);
  unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
