import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchEventBySlug } from '@/lib/api';
import { formatWatDateTime } from '@/lib/campus-data';
import { EventDetailView } from '@/components/events/EventDetailClient';

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);
  if (!event) {
    return {
      title: 'Event Not Found',
    };
  }

  const wat = formatWatDateTime(event.startsAt);
  const title = `${event.title} · ${wat.compactLabel} at ${event.venueName}`;
  const description = `Hosted by ${event.organizer.name} · ${event.rsvpCount} going on CampusPulse`;

  return {
    title: event.title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PublicEventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const query = await searchParams;
  const attribution = new URLSearchParams();
  for (const key of ['ref', 'invite']) {
    const value = query[key];
    if (typeof value === 'string') attribution.set(key, value);
  }
  const returnTo = '/e/' + slug + (attribution.size ? '?' + attribution : '');
  return <EventDetailView event={event} returnTo={returnTo} />;
}
