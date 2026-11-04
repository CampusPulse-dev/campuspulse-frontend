'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge, CATEGORY_LABELS } from '@/components/ui/Badge';
import { StoriesTray } from '@/components/stories/StoriesTray';
import { EventCard } from './EventCard';
import { fetchEventFeed, type EventCategory } from '@/lib/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type EnrichedEvent, type EnrichedStory, type TonightMood } from '@/lib/campus-data';
import { useAuth } from '@/lib/auth-context';
import { springSnappy } from '@/lib/motion';
import styles from './HomeFeed.module.css';

const MOOD_CHIPS: { id: TonightMood; label: string; emoji: string }[] = [
  { id: 'CHILL', label: 'Chill', emoji: '🌙' },
  { id: 'TURN_UP', label: 'Turn up', emoji: '🔥' },
  { id: 'LEARN', label: 'Learn', emoji: '💡' },
  { id: 'WATCH_GAME', label: 'Watch the game', emoji: '⚽' },
];

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
  const { user, persona, followedOrganizerIds } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'ALL'>('ALL');
  const [selectedMood, setSelectedMood] = useState<TonightMood | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
      if (
        selectedMood &&
        (event.tonightMood !== selectedMood ||
          Date.parse(event.startsAt) < now ||
          Date.parse(event.startsAt) > now + 6 * 60 * 60 * 1000)
      ) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          event.title.toLowerCase().includes(q) ||
          event.venueName.toLowerCase().includes(q) ||
          event.organizer.name.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [events, selectedCategory, selectedMood, searchQuery, now]);

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
    setSelectedMood(null);
    setSearchQuery('');
  }

  return (
    <div className={styles.feedContainer}>
      {/* 1. Search & Campus Pulse Hero Strip */}
      <div className={styles.searchRow}>
        <Link href="/search">Search events &amp; verified clubs →</Link>
        <label className={styles.searchBox}>
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search events, SUB Field, Trenchard Hall, clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search campus events and clubs"
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </label>
      </div>

      {/* 2. 24-Hour Stories Row (Hidden cleanly if empty) */}
      {storiesError ? (
        <p role="alert">
          Stories unavailable. <Button onClick={() => window.location.reload()}>Retry</Button>
        </p>
      ) : (
        <StoriesTray stories={stories} />
      )}

      {/* 3. "Tonight" Mood Row */}
      <section className={styles.moodSection} aria-label="Tonight Mood Quick Filters">
        <div className={styles.sectionHeaderInline}>
          <span className={styles.tonightTitle}>⚡ Tonight on Campus</span>
          {persona ? <Badge variant="verified">{persona.personaBadge}</Badge> : null}
        </div>
        <div className={styles.moodRow}>
          {MOOD_CHIPS.map((mood) => {
            const active = selectedMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                aria-pressed={active}
                className={`${styles.moodChip} ${active ? styles.moodChipActive : ''}`}
                onClick={() => setSelectedMood(active ? null : mood.id)}
              >
                <span aria-hidden="true">{mood.emoji}</span>
                <span>{mood.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Sticky 5-Category Filter Bar */}
      <nav className={styles.categoryBar} aria-label="Event Categories">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          const label = cat === 'ALL' ? 'All Events' : CATEGORY_LABELS[cat];
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={active}
              className={`${styles.catFilterBtn} ${active ? styles.catFilterActive : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {active ? (
                <motion.span
                  layoutId="cp-feed-cat-indicator"
                  className={styles.catActiveBg}
                  transition={springSnappy}
                />
              ) : null}
              <span className={styles.catFilterText}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* 5. "For You" Horizontal Row (when unfiltered) */}
      {user && selectedCategory === 'ALL' && !selectedMood && !searchQuery ? (
        <section className={styles.forYouSection} aria-label="Recommended For You">
          <div className={styles.sectionHeaderInline}>
            <h2 className={styles.sectionTitle}>For You at UI</h2>
            <span className={styles.sectionHint}>Ranked by your clubs &amp; friends going</span>
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
          <h2 className={styles.sectionTitle}>Upcoming Feed ({filteredEvents.length})</h2>
          {selectedCategory !== 'ALL' || selectedMood || searchQuery ? (
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
        ) : filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              Nothing live in this filter tonight — check out what&apos;s coming up this week.
            </p>
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className={styles.feedStack}>
            {filteredEvents.map((event) => (
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
