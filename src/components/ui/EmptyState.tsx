import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Icon } from './Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  /** The one thing to do next. */
  action?: { href: string; label: string };
  /** A quieter second option. */
  secondary?: { href: string; label: string };
  /** Content that keeps the page useful below the message, such as suggestions. */
  children?: React.ReactNode;
}

/** A blank list that still says what to do next, instead of leaving the page empty. */
export function EmptyState({ icon, title, body, action, secondary, children }: EmptyStateProps) {
  return (
    <section className={styles.root}>
      <div className={styles.card}>
        <span className={styles.badge}>
          <Icon icon={icon} size={24} />
        </span>
        <div className={styles.copy}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.body}>{body}</p>
        </div>
        {action || secondary ? (
          <div className={styles.actions}>
            {action ? (
              <Link href={action.href} className={styles.primary}>
                {action.label}
              </Link>
            ) : null}
            {secondary ? (
              <Link href={secondary.href} className={styles.secondary}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled block of suggestions that sits under an empty state. */
export function Suggestions({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.suggestions}>
      <h3 className={styles.eyebrow}>{title}</h3>
      {children}
    </div>
  );
}
