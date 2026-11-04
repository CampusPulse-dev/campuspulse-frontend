import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.css';
export function TextLink({ className = '', ...props }: ComponentProps<typeof Link>) {
  return <Link className={`${styles.textLink} ${className}`} {...props} />;
}
