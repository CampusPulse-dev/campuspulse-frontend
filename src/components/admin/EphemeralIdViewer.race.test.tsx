import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EphemeralIdViewer } from './EphemeralIdViewer';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(['fetch', 'decode'])(
  'invalidates a pending %s when the reviewer hides the tab',
  async (stage) => {
    let resolveLoad!: (blob: Blob) => void;
    const pending = new Promise<Blob>((resolve) => {
      resolveLoad = resolve;
    });
    const create = vi.fn(() => 'blob:synthetic');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    let decode!: () => void;
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const image = {
        onload: null,
        onerror: null,
        naturalWidth: 20,
        naturalHeight: 20,
      } as unknown as HTMLImageElement;
      Object.defineProperty(image, 'src', {
        set() {
          decode = () => (image.onload as () => void)?.();
        },
      });
      return image;
    } as unknown as typeof Image);
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: draw,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      measureText: () => ({ width: 20 }),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    render(<EphemeralIdViewer load={() => pending} watermark="Synthetic reviewer" />);
    fireEvent.click(screen.getByRole('button', { name: 'View ID image' }));
    if (stage === 'decode') {
      resolveLoad(new Blob(['synthetic']));
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    }
    hidden.mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    hidden.mockReturnValue(false);
    await act(async () => {
      if (stage === 'fetch') {
        resolveLoad(new Blob(['synthetic']));
        await Promise.resolve();
      }
      decode?.();
      await Promise.resolve();
    });
    expect(draw).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: 'Student ID image, watermarked' })).toBeNull();
    if (stage === 'fetch') expect(create).not.toHaveBeenCalled();
  },
);
