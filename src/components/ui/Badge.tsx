import React from 'react';
import type { EventCategory } from '@/lib/api';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const classes = [styles.badge, styles[variant], className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  SOCIAL_PARTY: 'Social / Party',
  PERFORMANCE_ARTS: 'Performance / Arts',
  ACADEMIC_CONFERENCE: 'Academic',
  SPORTS_RECREATION: 'Sports',
  CLUB_SOCIETY: 'Club / Society',
};

const CATEGORY_CLASS: Record<EventCategory, string> = {
  SOCIAL_PARTY: styles.catSocial ?? '',
  PERFORMANCE_ARTS: styles.catPerformance ?? '',
  ACADEMIC_CONFERENCE: styles.catAcademic ?? '',
  SPORTS_RECREATION: styles.catSports ?? '',
  CLUB_SOCIETY: styles.catClub ?? '',
};

export interface CategoryPillProps {
  category: EventCategory;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryPill({
  category,
  active = false,
  onClick,
  className = '',
}: CategoryPillProps) {
  const label = CATEGORY_LABELS[category];
  const classes = [
    styles.categoryPill,
    CATEGORY_CLASS[category],
    active ? styles.activePill : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-pressed={active}>
        <span className={styles.dot} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <span className={classes}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
