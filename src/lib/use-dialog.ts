'use client';
import { useEffect, useRef, type RefObject } from 'react';
export function useDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const callback = useRef(onClose);
  useEffect(() => {
    callback.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ),
      );
    (focusables()[0] ?? element).focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        callback.current();
      }
      if (event.key === 'Tab') {
        const items = focusables();
        const first = items[0];
        const last = items.at(-1);
        if (!first) {
          event.preventDefault();
          element.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, [open, ref]);
}
