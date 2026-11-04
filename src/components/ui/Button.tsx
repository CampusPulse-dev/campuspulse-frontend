'use client';

import React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { springSnappy } from '@/lib/motion';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'text' | 'ghostDanger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

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
  const shouldReduceMotion = useReducedMotion();
  const isDisabled = Boolean(disabled || isLoading);

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
    <motion.button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={isLoading ? 'true' : undefined}
      whileTap={!isDisabled && !shouldReduceMotion ? { scale: 0.97 } : undefined}
      transition={springSnappy}
      {...props}
    >
      {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span className={styles.label}>{children}</span>
    </motion.button>
  );
}
