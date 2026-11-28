import { CalendarHeart, QrCode, Users } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { PulseScene } from '@/components/brand/PulseScene';
import styles from './Auth.module.css';

/** The wide-screen half of the sign-in and sign-up pages. Hidden on phones. */
export function AuthBrandPanel() {
  return (
    <aside className={styles.brandPanel} aria-label="Why CampusPulse">
      <PulseScene />
      <div className={styles.brandCopy}>
        <p className={styles.brandEyebrow}>University of Ibadan</p>
        <h2 className={styles.brandHeadline}>Every event on campus, in one feed.</h2>
        <ul className={styles.brandPoints}>
          <li>
            <Icon icon={CalendarHeart} size={20} /> Parties, matches, plays and talks from verified
            clubs
          </li>
          <li>
            <Icon icon={Users} size={20} /> See which friends are going before you decide
          </li>
          <li>
            <Icon icon={QrCode} size={20} /> Your pass opens at the door, even with no signal
          </li>
        </ul>
      </div>
    </aside>
  );
}
