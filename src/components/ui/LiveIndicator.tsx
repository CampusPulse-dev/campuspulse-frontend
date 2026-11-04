import { PulseLine } from './PulseLine';
import styles from './Badge.module.css';
/** The brand pulse line plus visible text: live state never relies on colour or motion alone. */
export function LiveIndicator({ label = 'Live' }: { label?: string }) {
  return (
    <span className={styles.liveIndicator}>
      <PulseLine size="sm" />
      {label}
    </span>
  );
}
