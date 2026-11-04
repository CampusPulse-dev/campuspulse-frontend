import { DEMO_MODE } from '@/lib/mode';
import styles from './AttendeeShell.module.css';
export function DemoBanner() {
  return DEMO_MODE ? (
    <div role="status" className={styles.demoBanner}>
      <span aria-hidden="true" />
      Demo · Sample data · Passes not valid for entry
    </div>
  ) : null;
}
