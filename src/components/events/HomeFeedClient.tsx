'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CATEGORY_LABELS } from '@/components/ui/Badge';
import { StoriesTray } from '@/components/stories/StoriesTray';
import { EventCard } from './EventCard';
import { fetchEventFeed, type EventCategory } from '@/lib/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { type EnrichedEvent, type EnrichedStory } from '@/lib/campus-data';
import { useAuth } from '@/lib/auth-context';
import styles from './HomeFeed.module.css';

const CATEGORIES: (EventCategory | 'ALL')[] = [
  'ALL',
  'SOCIAL_PARTY',
  'PERFORMANCE_ARTS',
  'ACADEMIC_CONFERENCE',
  'SPORTS_RECREATION',
  'CLUB_SOCIETY',
];

export interface HomeFeedClientProps {
  initialEvents: EnrichedEvent[];
  stories: EnrichedStory[];
  initialCursor?: string | null;
  initialError?: string | null;
  storiesError?: string | null;
}

export function HomeFeedClient({
  initialEvents,
  stories,
  initialCursor = null,
  initialError,
  storiesError,
}: HomeFeedClientProps) {
  const { user, followedOrganizerIds } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'ALL'>('ALL');
  const [period, setPeriod] = useState('All');

  const pages = useInfiniteQuery({
    queryKey: ['feed', selectedCategory],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchEventFeed({
        cursor: pageParam,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(selectedCategory === 'ALL' && !initialError
      ? {
          initialData: {
            pages: [{ items: initialEvents, nextCursor: initialCursor }],
            pageParams: [undefined],
          },
        }
      : {}),
    retry: false,
  });
  const events = useMemo(() => pages.data?.pages.flatMap((p) => p.items) ?? [], [pages.data]);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  useEffect(() => {
    if (!sentinel.current || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const filteredEvents = useMemo(() => {
    const base = events;
    return base.filter((event) => {
      if (selectedCategory !== 'ALL' && event.category !== selectedCategory) {
        return false;
      }
      const start = Date.parse(event.startsAt);
      if (period === 'Tonight' && (start < now || start > now + 6 * 60 * 60 * 1000)) return false;
      if (period === 'This week' && (start < now || start > now + 7 * 24 * 60 * 60 * 1000))
        return false;
      return true;
    });
  }, [events, selectedCategory, period, now]);

  const forYouEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const aFollowed = followedOrganizerIds.includes(a.organizer.id) ? 1 : 0;
        const bFollowed = followedOrganizerIds.includes(b.organizer.id) ? 1 : 0;
        return bFollowed - aFollowed || b.friendsGoingCount - a.friendsGoingCount;
      })
      .slice(0, 3);
  }, [events, followedOrganizerIds]);

  function handleResetFilters() {
    setSelectedCategory('ALL');
    setPeriod('All');
  }

  const showRecommendations = Boolean(
    user && selectedCategory === 'ALL' && period === 'All' && forYouEvents.length,
  );
  const listEvents = showRecommendations
    ? filteredEvents.filter(
        (event) => !forYouEvents.some((recommended) => recommended.id === event.id),
      )
    : filteredEvents;
  return (
    <div className={styles.feedContainer}>
      <header className={styles.feedHeader}>
        <h1>Find your next plan.</h1>
        <p>What’s happening at the University of Ibadan.</p>
      </header>
      {storiesError ? (
        <p role="alert">
          Stories unavailable. <Button onClick={() => window.location.reload()}>Retry</Button>
        </p>
      ) : (
        <StoriesTray stories={stories} />
      )}

      <div className={styles.filterBar}>
        <div className={styles.periodRow} role="group" aria-label="Event dates">
          {['Tonight', 'This week', 'All'].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              className={period === value ? styles.periodActive : ''}
              onClick={() => setPeriod(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <nav className={styles.categoryBar} aria-label="Event Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedCategory === cat}
              className={[
                styles.catFilterBtn,
                selectedCategory === cat ? styles.catFilterActive : '',
              ].join(' ')}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'ALL' ? 'All Events' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </nav>
      </div>
      {/* 5. "For You" Horizontal Row (when unfiltered) */}
      {showRecommendations ? (
        <section className={styles.forYouSection} aria-label="Recommended For You">
          <div className={styles.sectionHeaderInline}>
            <h2 className={styles.sectionTitle}>For you</h2>
          </div>
          <div className={styles.forYouScroller}>
            {forYouEvents.map((ev) => (
              <div key={`foryou-${ev.id}`} className={styles.forYouItem}>
                <EventCard event={ev} compact />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6. Primary Chronological Event Feed */}
      <section className={styles.primaryFeedSection} aria-label="Upcoming Campus Events">
        <div className={styles.sectionHeaderInline}>
          <h2 className={styles.sectionTitle}>Upcoming events</h2>
          {selectedCategory !== 'ALL' || period !== 'All' ? (
            <button type="button" className={styles.inlineResetLink} onClick={handleResetFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {pages.isPending ? (
          <p role="status">Loading events…</p>
        ) : pages.isError ? (
          <div role="alert">
            <p>Could not load events. Please retry.</p>
            <Button onClick={() => void pages.refetch()}>Retry</Button>
          </div>
        ) : listEvents.length === 0 && !showRecommendations ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              No events in this view. Try another date or category.
            </p>
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className={styles.feedStack}>
            {listEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
        <div ref={sentinel} />
        {pages.hasNextPage ? (
          <Button
            variant="secondary"
            isLoading={pages.isFetchingNextPage}
            onClick={() => void pages.fetchNextPage()}
          >
            Load more events
          </Button>
        ) : null}
      </section>
    </div>
  );
}
