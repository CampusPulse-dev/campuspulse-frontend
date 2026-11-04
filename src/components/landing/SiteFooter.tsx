import Link from 'next/link';
import styles from './Landing.module.css';
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerWordmark}>CampusPulse.</div>
      <div className={styles.footerGrid}>
        <p>
          Good plans start here.
          <br />
          The heartbeat of student life.
        </p>
        <div>
          <h3>Students</h3>
          <Link href="/explore">Explore events</Link>
          <Link href="/tickets">Your tickets</Link>
          <Link href="/sign-up">Create an account</Link>
        </div>
        <div>
          <h3>Organizers</h3>
          <Link href="/organizer/apply">Apply for a club</Link>
          <Link href="/organizer">Organizer portal</Link>
        </div>
        <div>
          <h3>Trust</h3>
          <Link href="/#privacy">Privacy &amp; NDPA</Link>
          <Link href="/#report">Report an event</Link>
          <Link href="/#faq">Questions</Link>
        </div>
      </div>
      <div className={styles.legal}>
        <span>Made at the University of Ibadan</span>
        <span>CampusPulse · Student life, connected.</span>
      </div>
    </footer>
  );
}
