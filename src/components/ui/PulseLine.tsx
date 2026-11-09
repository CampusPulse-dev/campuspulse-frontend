import styles from './PulseLine.module.css';
// The two ECG peaks follow the relative geometry of public/brand/logo.svg.
export function PulseLine({
  animated = false,
  size = 'md',
  className = '',
}: {
  animated?: boolean;
  /** `sm` is the 32×12 live-event mark; it beats gently unless motion is reduced. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <svg
      className={[
        styles.pulse,
        size === 'sm' ? styles.sm : '',
        animated ? styles.draw : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 320 72"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 36H92L112 7L151 66L168 36H320"
        pathLength="1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
