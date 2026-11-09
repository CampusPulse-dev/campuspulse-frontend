'use client';

import React, { useCallback, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { EnrichedStory } from '@/lib/campus-data';
import { StoryViewer } from './StoryViewer';
import styles from './Stories.module.css';

export interface StoriesTrayProps {
  stories: EnrichedStory[];
}

export function StoriesTray({ stories }: StoriesTrayProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [viewedIds, setViewedIds] = useState<string[]>([]);

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

      <StoryViewer
        stories={stories}
        activeIndex={activeIndex}
        onSelectIndex={select}
        onClose={close}
      />
    </section>
  );
}
