import React from 'react';
import styles from './Feedback.module.css';

export interface SkeletonProps {
  width?: string;
  height?: string;
  /** Size by shape instead of height, e.g. "16 / 9" for an event poster. */
  aspectRatio?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1.25rem',
  aspectRatio,
  rounded = 'md',
  className = '',
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[`radius-${rounded}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      style={aspectRatio ? { width, aspectRatio } : { width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * A loading region the size of the content that will land there. It announces
 * `label` to screen readers and fades in only after 300 ms, so a fast load
 * never flashes it.
 */
export function SkeletonGroup({
  label = 'Loading…',
  className = '',
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={`${styles.skeletonGroup} ${className}`.trim()}>
      <span className={styles.visuallyHidden}>{label}</span>
      {children}
    </div>
  );
}

/** Placeholder event cards: a 16:9 poster, a title line and a meta line. */
export function EventCardsSkeleton({
  count = 4,
  label = 'Loading events…',
  className = '',
}: {
  count?: number;
  label?: string;
  /** The grid class the real cards render in, so nothing shifts when they land. */
  className?: string;
}) {
  return (
    <SkeletonGroup label={label} className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonCard}>
          <Skeleton aspectRatio="16 / 9" rounded="lg" />
          <Skeleton width="72%" height="1.125rem" />
          <Skeleton width="44%" height="0.875rem" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Placeholder list rows, for tickets, events on a dashboard and similar lists. */
export function RowsSkeleton({
  count = 4,
  label = 'Loading…',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <SkeletonGroup label={label} className={styles.skeletonRows}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height="4rem" rounded="lg" />
      ))}
    </SkeletonGroup>
  );
}
