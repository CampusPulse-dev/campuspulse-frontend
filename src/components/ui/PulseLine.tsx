import styles from './PulseLine.module.css';
// The two ECG peaks follow the relative geometry of public/brand/logo.svg.
export function PulseLine({
  animated = false,
  className = '',
}: {
  animated?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`${styles.pulse} ${animated ? styles.draw : ''} ${className}`}
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
