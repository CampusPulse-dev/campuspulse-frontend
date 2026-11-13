'use client';

import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { EnrichedStory } from '@/lib/campus-data';
import styles from './Stories.module.css';

// The viewer (and its animation library) only loads once someone opens a story, so
// it never weighs on the feed's first paint. Hover or focus starts the download early.
const loadViewer = () => import('./StoryViewer');
const StoryViewer = lazy(() => loadViewer().then((m) => ({ default: m.StoryViewer })));

export interface StoriesTrayProps {
  stories: EnrichedStory[];
}

export function StoriesTray({ stories }: StoriesTrayProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [viewerWanted, setViewerWanted] = useState(false);

  const close = useCallback(() => setActiveIndex(null), []);
  const select = useCallback(
    (idx: number) => {
      setActiveIndex(idx);
      const item = stories[idx];
      if (item) setViewedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    },
    [stories],
  );
  if (stories.length === 0) {
    return null;
  }

  function handleOpenStory(idx: number, storyId: string) {
    setViewerWanted(true);
    setActiveIndex(idx);
    setViewedIds((prev) => (prev.includes(storyId) ? prev : [...prev, storyId]));
  }

  return (
    <section className={styles.traySection} aria-label="24-hour Campus Club Stories">
      <div className={styles.trayRow}>
        {stories.map((story, idx) => {
          const isViewed = viewedIds.includes(story.id);
          return (
            <button
              key={story.id}
              type="button"
              className={styles.storyTrigger}
              onClick={() => handleOpenStory(idx, story.id)}
              onPointerEnter={() => void loadViewer()}
              onFocus={() => void loadViewer()}
              aria-label={`${story.organizer.name} story`}
            >
              <Avatar
                name={story.organizer.name}
                src={story.organizer.logoUrl}
                size="lg"
                isVerified={story.organizer.isVerified}
                hasStoryRing
                isStoryViewed={isViewed}
              />
              <span className={styles.storyClubName}>{story.organizer.name}</span>
            </button>
          );
        })}
      </div>

      {viewerWanted ? (
        <Suspense fallback={null}>
          <StoryViewer
            stories={stories}
            activeIndex={activeIndex}
            onSelectIndex={select}
            onClose={close}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
