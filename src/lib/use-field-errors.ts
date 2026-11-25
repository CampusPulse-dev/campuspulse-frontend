'use client';
import { useState } from 'react';

export type FieldRules<K extends string> = Record<K, (value: string) => string | null>;

/** Accepts stray spaces and capitals, gives back one clean address. */
export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailProblem(value: string, label = 'your email'): string | null {
  const email = normalizeEmail(value);
  if (!email) return `Enter ${label}.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'That email looks incomplete. Use the form you@stu.ui.edu.ng.';
  return null;
}

/**
 * Field-level validation on the right clock: nothing shows while someone types
 * a field for the first time; a field is checked when they leave it (if they
 * typed anything) or on submit; once a field shows an error, it re-checks on
 * every keystroke so the message clears the moment it's fixed.
 */
export function useFieldErrors<K extends string>(values: Record<K, string>, rules: FieldRules<K>) {
  const [checked, setChecked] = useState<K[]>([]);
  const keys = Object.keys(rules) as K[];
  const errors = Object.fromEntries(
    keys.map((key) => [key, checked.includes(key) ? rules[key](values[key]) : null]),
  ) as Record<K, string | null>;

  function check(key: K) {
    setChecked((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  return {
    errors,
    /** Spread onto a field: validates on blur once something was typed. */
    blurProps: (key: K) => ({
      name: key,
      onBlur: () => {
        if (values[key].trim()) check(key);
      },
    }),
    /**
     * Checks every field. Returns true when all pass; otherwise focuses and
     * shakes the first field that fails, inside `form`.
     */
    validateAll(form: HTMLFormElement | null): boolean {
      setChecked(keys);
      const first = keys.find((key) => rules[key](values[key]));
      if (!first) return true;
      const element = form?.elements.namedItem(first);
      if (element instanceof HTMLElement) {
        element.focus();
        shake(element);
      }
      return false;
    },
  };
}

/** Error shake on submit only (never on blur), skipped under reduced motion. */
export function shake(element: HTMLElement) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  element.animate?.(
    [0, -10, 10, -6, 6, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 360, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
  );
}
