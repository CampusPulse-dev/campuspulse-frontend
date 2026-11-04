import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchOrganizerBySlug } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { formatWatDateTime } from '@/lib/campus-data';
import { OrganizerFollowButton } from './OrganizerFollowButton';
import styles from './OrganizerProfile.module.css';

interface OrganizerPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: OrganizerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchOrganizerBySlug(slug);
  if (!data) return { title: 'Club Not Found' };
  return {
    title: `${data.organizer.name} · Verified Club`,
    description: data.organizer.bio ?? `Events hosted by ${data.organizer.name} on CampusPulse.`,
  };
}

export default async function PublicOrganizerPage({ params }: OrganizerPageProps) {
  const { slug } = await params;
  const data = await fetchOrganizerBySlug(slug);

  if (!data) {
    notFound();
  }

  const { organizer, events } = data;

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.topRow}>
          <Avatar
            name={organizer.name}
            src={organizer.logoUrl}
            size="lg"
            isVerified={organizer.isVerified}
          />
          <OrganizerFollowButton
            organizerId={organizer.id}
            initialFollowerCount={organizer.followerCount}
          />
        </div>

        <div className={styles.titleBlock}>
          <div className={styles.nameRow}>
            <h1 className={styles.clubName}>{organizer.name}</h1>
            {organizer.isVerified ? <Badge variant="verified">Verified UI Club</Badge> : null}
          </div>
          {organizer.bio ? <p className={styles.bio}>{organizer.bio}</p> : null}
        </div>
      </section>

      <section className={styles.eventsSection}>
        <h2 className={styles.sectionTitle}>Upcoming & Active Events ({events.length})</h2>
        <div className={styles.eventList}>
          {events.map((ev) => {
            const wat = formatWatDateTime(ev.startsAt);
            return (
              <Link key={ev.id} href={`/e/${ev.slug}`} className={styles.eventRowCard}>
                <div className={styles.eventMetaTop}>
                  <CategoryPill category={ev.category} />
                  <span className={styles.eventDateMono}>{wat.compactLabel} WAT</span>
                </div>
                <h3 className={styles.eventTitle}>{ev.title}</h3>
                <p className={styles.eventVenue}>
                  📍 {ev.venueName} · <strong>{ev.rsvpCount} going</strong>
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
