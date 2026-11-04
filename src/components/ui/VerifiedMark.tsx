import { BadgeCheck } from 'lucide-react';
import { Icon } from './Icon';
import styles from './Badge.module.css';
export function VerifiedMark({ size = 18 }: { size?: number }) {
  return (
    <span className={styles.verifiedMark} role="img" aria-label="Verified">
      <Icon icon={BadgeCheck} size={size} />
    </span>
  );
}
