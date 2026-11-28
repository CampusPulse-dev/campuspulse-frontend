import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Clapperboard, PartyPopper, Trophy, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { fetchOrganizerBySlug, type EventCategory } from '@/lib/api';
import { imageSource } from '@/lib/media';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { CATEGORY_CLASS, CategoryPill } from '@/components/ui/Badge';
import { formatWatDateTime } from '@/lib/campus-data';
import { OrganizerFollowButton } from './OrganizerFollowButton';
import styles from './OrganizerProfile.module.css';

const CATEGORY_ICONS = {
  SOCIAL_PARTY: PartyPopper,
  PERFORMANCE_ARTS: Clapperboard,
  ACADEMIC_CONFERENCE: BookOpen,
  SPORTS_RECREATION: Trophy,
  CLUB_SOCIETY: Users,
} satisfies Record<EventCategory, typeof PartyPopper>;

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
          <Avatar name={organizer.name} src={organizer.logoUrl} size="lg" />
          <OrganizerFollowButton
            organizerId={organizer.id}
            initialFollowerCount={organizer.followerCount}
          />
        </div>

        <div className={styles.titleBlock}>
          <div className={styles.nameRow}>
            <h1 className={styles.clubName}>{organizer.name}</h1>
            {organizer.isVerified ? <VerifiedMark size={22} /> : null}
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
                {ev.coverImageUrl ? (
                  <Image
                    {...imageSource(ev.coverImageUrl)}
                    width={144}
                    height={144}
                    sizes="(max-width: 479px) 64px, 72px"
                    loading="lazy"
                    alt=""
                    aria-hidden="true"
                    className={styles.eventThumbnail}
                  />
                ) : (
                  <span
                    className={`${styles.eventThumbnail} ${styles.eventThumbnailFallback} ${CATEGORY_CLASS[ev.category]}`}
                    aria-hidden="true"
                  >
                    <Icon icon={CATEGORY_ICONS[ev.category]} size={26} />
                  </span>
                )}
                <div className={styles.eventText}>
                  <div className={styles.eventMetaTop}>
                    <CategoryPill category={ev.category} />
                    <span className={styles.eventDateMono}>{wat.compactLabel} WAT</span>
                  </div>
                  <h3 className={styles.eventTitle}>{ev.title}</h3>
                  <p className={styles.eventVenue}>
                    {ev.venueName} · <strong>{ev.rsvpCount} going</strong>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
