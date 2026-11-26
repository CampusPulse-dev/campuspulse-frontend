import styles from './EmptyArt.module.css';

const illustrations = {
  ticket: (
    <>
      <path
        className={styles.fill}
        d="M28 28h48v10a10 10 0 0 0 0 20v10H20V58a10 10 0 0 0 0-20V28h8Z"
      />
      <path className={styles.accent} d="M30 48h9l5-8 8 16 5-8h9" />
    </>
  ),
  calendar: (
    <>
      <rect className={styles.fill} x="21" y="24" width="54" height="50" rx="7" />
      <path d="M21 38h54M34 19v10m28-10v10" />
      <path className={styles.accent} d="M31 56h10l5-8 7 16 5-8h7" />
    </>
  ),
  stage: (
    <>
      <path className={styles.fill} d="M43 22h10l21 44H22l21-44Z" />
      <path className={styles.accent} d="M34 22h28m-14-7v7m-32 45h64v9H16z" />
      <path d="M39 56h18" />
    </>
  ),
};

export function EmptyArt({ variant }: { variant: keyof typeof illustrations }) {
  return (
    <svg
      className={styles.art}
      aria-hidden="true"
      focusable="false"
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {illustrations[variant]}
    </svg>
  );
}
