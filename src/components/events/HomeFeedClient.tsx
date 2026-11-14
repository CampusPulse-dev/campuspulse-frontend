'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CATEGORY_LABELS } from '@/components/ui/Badge';
import { StoriesTray } from '@/components/stories/StoriesTray';
import { EventCard } from './EventCard';
import { fetchEventFeed, type EventCategory } from '@/lib/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Coffee, PartyPopper, Lightbulb, Trophy, type LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import {
  isThisWeek,
  isTonight,
  tonightEndsAt,
  weekEndsAt,
  type EnrichedEvent,
  type EnrichedStory,
  type TonightMood,
} from '@/lib/campus-data';
import { useAuth } from '@/lib/auth-context';
import styles from './HomeFeed.module.css';

const MOOD_CHIPS: { id: TonightMood; label: string; icon: LucideIcon }[] = [
  { id: 'CHILL', label: 'Chill', icon: Coffee },
  { id: 'TURN_UP', label: 'Turn up', icon: PartyPopper },
  { id: 'LEARN', label: 'Learn', icon: Lightbulb },
  { id: 'WATCH_GAME', label: 'Watch the game', icon: Trophy },
];
/** Extra pages to pull in looking for matches before showing the empty state. */
const MAX_FILTER_PAGES = 5;

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
  const [period, setPeriodState] = useState('All');
  const [selectedMood, setSelectedMood] = useState<TonightMood | null>(null);
  function setPeriod(value: string) {
    setPeriodState(value);
    if (value !== 'Tonight') setSelectedMood(null);
  }

  const pages = useInfiniteQuery({
    queryKey: ['feed', selectedCategory, user?.id ?? 'guest'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchEventFeed({
        cursor: pageParam,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(!user && selectedCategory === 'ALL' && !initialError
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
      if (period === 'Tonight' && !isTonight(event, now)) return false;
      if (period === 'This week' && !isThisWeek(event, now)) return false;
      if (selectedMood && event.tonightMood !== selectedMood) return false;
      return true;
    });
  }, [events, selectedCategory, period, selectedMood, now]);

  // Date and mood filters run client-side over a chronological, paginated feed,
  // so keep pulling pages until the window is covered before declaring "empty".
  const windowEnd =
    period === 'Tonight' ? tonightEndsAt(now) : period === 'This week' ? weekEndsAt(now) : null;
  const lastLoadedStart = events.length ? Date.parse(events[events.length - 1]!.startsAt) : null;
  const pagesLoaded = pages.data?.pages.length ?? 0;
  // The extra-page budget restarts whenever the filter changes (adjusting state
  // during render, per React's "you might not need an effect").
  const filterKey = [period, selectedMood, selectedCategory].join('|');
  const [budget, setBudget] = useState({ key: filterKey, base: pagesLoaded });
  if (budget.key !== filterKey) setBudget({ key: filterKey, base: pagesLoaded });
  const filterBasePages = budget.key === filterKey ? budget.base : pagesLoaded;
  const filtering = windowEnd !== null || selectedMood !== null;
  const windowCovered =
    !filtering || (windowEnd !== null && lastLoadedStart !== null && lastLoadedStart >= windowEnd);
  const seekingMatches =
    filtering && !windowCovered && hasNextPage && pagesLoaded - filterBasePages < MAX_FILTER_PAGES;
  useEffect(() => {
    if (seekingMatches && !isFetchingNextPage) void fetchNextPage();
  }, [seekingMatches, isFetchingNextPage, fetchNextPage]);

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

  const filtersActive = selectedCategory !== 'ALL' || period !== 'All' || selectedMood !== null;

  const showRecommendations = Boolean(user && !filtersActive && forYouEvents.length);
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
        {period === 'Tonight' ? (
          <div className={styles.moodRow} role="group" aria-label="Tonight's mood">
            {MOOD_CHIPS.map((mood) => (
              <button
                key={mood.id}
                type="button"
                aria-pressed={selectedMood === mood.id}
                className={[
                  styles.catFilterBtn,
                  selectedMood === mood.id ? styles.catFilterActive : '',
                ].join(' ')}
                onClick={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
              >
                <Icon icon={mood.icon} size={16} />
                {mood.label}
              </button>
            ))}
          </div>
        ) : null}
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
          {filtersActive ? (
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
        ) : listEvents.length === 0 && (seekingMatches || isFetchingNextPage) ? (
          <p role="status">Loading more events…</p>
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
