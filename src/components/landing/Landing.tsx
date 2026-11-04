import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  Check,
  ScanLine,
  WifiOff,
  Search,
  Ticket,
  ShieldCheck,
  Users,
  CircleAlert,
  X,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { BrandLockup } from '@/components/ui/BrandLockup';
import { PulseLine } from '@/components/ui/PulseLine';
import { ListRow } from '@/components/ui/ListRow';
import { EventCard } from '@/components/events/EventCard';
import type { EnrichedEvent } from '@/lib/campus-data';
import { SiteFooter } from './SiteFooter';
import styles from './Landing.module.css';

export function Landing({
  events,
  error = false,
  now = new Date(),
}: {
  events: EnrichedEvent[];
  error?: boolean;
  now?: Date;
}) {
  const posters = events.filter((event) => event.coverImageUrl);
  const tonight = events.filter(
    (event) =>
      Date.parse(event.startsAt) >= now.getTime() &&
      Date.parse(event.startsAt) <= now.getTime() + 6 * 60 * 60 * 1000,
  );
  const featured = (tonight.length ? tonight : events).slice(0, 4);
  return (
    <div className={styles.landing}>
      <div className={styles.heroWrap}>
        <nav className={styles.nav} aria-label="Public navigation">
          <Link href="/" className={styles.brand}>
            <BrandLockup inverse />
          </Link>
          <div className={styles.navAnchors}>
            <a href="#organizers">For organizers</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div className={styles.navActions}>
            <Link href="/sign-in" className={styles.signIn}>
              Sign in
            </Link>
            <Link href="/explore" className={styles.heroButton}>
              Explore events
              <Icon icon={ArrowUpRight} size={18} />
            </Link>
          </div>
        </nav>
        <section className={styles.hero} aria-labelledby="hero-title">
          {posters.length ? (
            <div className={styles.posterWall} aria-hidden="true">
              {posters.map((event) => (
                <Image
                  key={event.id}
                  src={event.coverImageUrl!}
                  alt=""
                  width={360}
                  height={480}
                  unoptimized
                />
              ))}
            </div>
          ) : null}
          <div className={styles.heroContent}>
            <p className={styles.heroKicker}>University of Ibadan. Your kind of night.</p>
            <h1 id="hero-title">
              If it’s happening,
              <br />
              it’s on <span>CampusPulse.</span>
            </h1>
            <p className={styles.heroCopy}>
              Every event on campus, in one feed.
              <br />
              And a real headcount at the door.
            </p>
            <div className={styles.heroActions}>
              <Link href="/explore" className={styles.heroButton}>
                Explore tonight’s events
                <Icon icon={ArrowUpRight} size={18} />
              </Link>
              <Link href="/sign-up" className={styles.heroSecondary}>
                Sign up with your @stu.ui.edu.ng
              </Link>
            </div>
            <PulseLine animated className={styles.heroPulse} />
            <div className={styles.heroFootnote}>
              <span>Find your people.</span>
              <span>Make a plan.</span>
              <span>Be there.</span>
            </div>
          </div>
        </section>
      </div>
      <section className={styles.section} aria-labelledby="events-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Out of the group chat. Into the night.</p>
            <h2 id="events-heading">{tonight.length ? 'Tonight at UI.' : 'Coming up at UI.'}</h2>
          </div>
          <Link href="/explore" className={styles.textLink}>
            See all events
            <Icon icon={ArrowUpRight} size={18} />
          </Link>
        </div>
        {error ? (
          <p role="status">
            Events are taking a moment to load. <Link href="/explore">Try discovery</Link>.
          </p>
        ) : featured.length ? (
          <div className={styles.eventGrid}>
            {featured.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p>New plans are on the way. Check back for the next campus events.</p>
        )}
      </section>
      <section
        id="how-it-works"
        className={`${styles.section} ${styles.stepsSection}`}
        aria-labelledby="steps-heading"
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Less planning. More showing up.</p>
            <h2 id="steps-heading">
              From “what’s the plan?”
              <br />
              to “I’m here.”
            </h2>
          </div>
        </div>
        <ol className={styles.steps}>
          {[
            {
              icon: Search,
              title: 'Find your thing.',
              copy: 'The party. The play. The match. All the plans on campus, together.',
            },
            {
              icon: Ticket,
              title: 'Make it a plan.',
              copy: 'RSVP for free. See which friends are going and keep your pass close.',
            },
            {
              icon: WifiOff,
              title: 'Show up. Even offline.',
              copy: 'Open your QR pass online once. Then take it to the door, signal or no signal.',
            },
          ].map((step, index) => (
            <li key={step.title}>
              <div className={styles.stepTop}>
                <span>0{index + 1}</span>
                <Icon icon={step.icon} size={24} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>
      <section
        id="organizers"
        className={`${styles.section} ${styles.organizerSection}`}
        aria-labelledby="organizer-heading"
      >
        <div className={styles.productComposition}>
          <div className={styles.productTitle}>
            <Icon icon={Users} />
            <span>Your next event</span>
            <span>Organizer view</span>
          </div>
          <ListRow title="Before the doors open" meta="Publish your event. Know who’s coming." />
          <ListRow
            title="When the crowd arrives"
            meta="Scan QR passes or check people in by name."
          />
          <ListRow title="After a good night" meta="See the RSVPs that became real check-ins." />
          <div className={styles.productStatus}>
            <Icon icon={ShieldCheck} />
            <span>Verified clubs. Clear headcounts.</span>
          </div>
        </div>
        <div>
          <p className={styles.kicker}>For the people who make it happen.</p>
          <h2 id="organizer-heading">
            You bring the night.
            <br />
            We’ll handle the door.
          </h2>
          <p className={styles.sectionCopy}>
            From your first announcement to the last check-in. One place to keep your club’s plans
            moving.
          </p>
          <ul className={styles.proofLines}>
            <li>
              <Icon icon={Check} />
              Publish once. Share everywhere.
            </li>
            <li>
              <Icon icon={Check} />
              Give your team the access they need.
            </li>
            <li>
              <Icon icon={Check} />
              Turn RSVPs into a real headcount.
            </li>
          </ul>
          <Link href="/organizer/apply" className={styles.primaryButton}>
            Apply for a club
            <Icon icon={ArrowUpRight} size={18} />
          </Link>
        </div>
      </section>
      <section className={`${styles.section} ${styles.doorSection}`} aria-labelledby="door-heading">
        <div>
          <p className={styles.kicker}>Built for the last metre.</p>
          <h2 id="door-heading">
            A good night doesn’t
            <br />
            need a good signal.
          </h2>
          <p className={styles.sectionCopy}>
            Offline passes for students. Clear results for the door team. Manual check-in sits right
            beside the scanner.
          </p>
          <div className={styles.doorTabs}>
            <span>
              <Icon icon={ScanLine} />
              QR Scanner
            </span>
            <span>
              <Icon icon={Users} />
              Manual Check-In
            </span>
          </div>
        </div>
        <div className={styles.scannerStates} aria-label="Scanner result examples">
          <div className={styles.valid}>
            <Icon icon={Check} size={28} />
            <div>
              <strong>Valid</strong>
              <span>You’re in. Enjoy the night.</span>
            </div>
          </div>
          <div className={styles.duplicate}>
            <Icon icon={CircleAlert} size={28} />
            <div>
              <strong>Already scanned</strong>
              <span>Check the first entry with your team.</span>
            </div>
          </div>
          <div className={styles.invalid}>
            <Icon icon={X} size={28} />
            <div>
              <strong>Invalid ticket</strong>
              <span>Check the event and pass details.</span>
            </div>
          </div>
        </div>
      </section>
      <section
        id="faq"
        className={`${styles.section} ${styles.faqSection}`}
        aria-labelledby="faq-heading"
      >
        <div>
          <p className={styles.kicker}>Before you head out.</p>
          <h2 id="faq-heading">
            A few good
            <br />
            questions.
          </h2>
        </div>
        <div className={styles.faq}>
          <details>
            <summary>Do I need to be a verified UI student?</summary>
            <p>
              You can explore without an account. Student-only events need verified student status:
              use your @stu.ui.edu.ng email, or submit an ID for private review. Open events welcome
              other guests.
            </p>
          </details>
          <details>
            <summary>Do I need to install an app?</summary>
            <p>
              No. Discovery and free RSVPs work in your browser. Open your pass online once and
              prepare offline access before heading to the venue.
            </p>
          </details>
          <details>
            <summary>Will my QR pass work without signal?</summary>
            <p>
              Yes, once the pass says it is ready for offline access on this device. Keep that
              device with you. A waitlisted or cancelled pass cannot be used for entry.
            </p>
          </details>
          <details id="privacy">
            <summary>What happens to my data?</summary>
            <p>
              Your RSVPs are visible to mutual friends by default, and you can keep them private in
              Settings. Student ID images are only reviewed by an authorized super admin, with
              audited access, and deleted immediately after a verification decision. CampusPulse’s
              privacy controls follow the NDPA requirements in our product policy.
            </p>
          </details>
          <details>
            <summary>Does it cost anything?</summary>
            <p>
              Exploring campus events and reserving free events is free. Check an event’s entry and
              door policies before you RSVP.
            </p>
          </details>
          <details id="report">
            <summary>How do I report an event?</summary>
            <p>
              Open the event page and choose “Report this event” at the bottom. Sign in and tell the
              moderation team what needs attention.
            </p>
          </details>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
