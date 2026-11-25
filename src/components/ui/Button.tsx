'use client';
import React, { useEffect, useRef, useState } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'text' | 'ghostDanger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

/** A spinner shows only once a request has taken this long… */
const SPINNER_DELAY_MS = 300;
/** …and, once shown, stays at least this long, so it never flickers. */
const SPINNER_MIN_MS = 500;

/**
 * The trigger disables on the same frame as `isLoading` (no double submits),
 * but the spinner waits 300 ms and then holds 500 ms: fast requests never
 * flash one, slow ones don't flicker.
 */
function useDelayedSpinner(isLoading: boolean) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (isLoading) {
      if (visible) return;
      const timer = window.setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SPINNER_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    if (!visible) return;
    const left = SPINNER_MIN_MS - (Date.now() - shownAt.current);
    const timer = window.setTimeout(() => setVisible(false), Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [isLoading, visible]);
  return visible;
}

/**
 * Press feedback is a CSS transform (see Button.module.css), not a motion
 * component: the button ships on every public page, and an animation library
 * there costs the first paint more than a 0.97 scale is worth.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const spinning = useDelayedSpinner(isLoading);
  const isDisabled = Boolean(disabled || isLoading || spinning);

  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={isLoading || spinning ? 'true' : undefined}
      {...props}
    >
      {spinning ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
