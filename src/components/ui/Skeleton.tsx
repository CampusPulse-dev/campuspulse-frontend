import React from 'react';
import styles from './Feedback.module.css';

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1.25rem',
  rounded = 'md',
  className = '',
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[`radius-${rounded}`], className]
    .filter(Boolean)
    .join(' ');
  return <div className={classes} style={{ width, height }} aria-hidden="true" />;
}
