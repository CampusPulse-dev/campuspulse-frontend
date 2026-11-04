'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { EnrichedStory } from '@/lib/campus-data';
import Image from 'next/image';
import { useDialog } from '@/lib/use-dialog';
import styles from './Stories.module.css';

export interface StoryViewerProps {
  stories: EnrichedStory[];
  activeIndex: number | null;
  onSelectIndex: (nextIndex: number) => void;
  onClose: () => void;
}

export function StoryViewer({ stories, activeIndex, onSelectIndex, onClose }: StoryViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useDialog(activeIndex !== null, ref, onClose);
  const activeStory = activeIndex !== null ? (stories[activeIndex] ?? null) : null;

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        if (activeIndex !== null && activeIndex < stories.length - 1) {
          onSelectIndex(activeIndex + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeIndex !== null && activeIndex > 0) {
          onSelectIndex(activeIndex - 1);
        }
      }
    }

    const timer = window.setTimeout(() => {
      if (activeIndex < stories.length - 1) {
        onSelectIndex(activeIndex + 1);
      } else {
        onClose();
      }
    }, 5000);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [activeIndex, stories.length, onSelectIndex, onClose]);

  return (
    <AnimatePresence>
      {activeStory && activeIndex !== null ? (
        <motion.div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${activeStory.organizer.name} Story`}
          className={styles.viewerOverlay}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.15 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 160 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90) {
              onClose();
            }
          }}
        >
          <div className={styles.viewerFrame}>
            {/* 5s Progress Bars */}
            <div className={styles.progressRow} aria-hidden="true">
              {stories.map((story, idx) => (
                <div key={story.id} className={styles.progressSegment}>
                  <div
                    className={`${styles.progressFill} ${
                      idx < activeIndex
                        ? styles.progressDone
                        : idx === activeIndex
                          ? styles.progressActive
                          : ''
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className={styles.viewerHeader}>
              <div className={styles.viewerAuthor}>
                <Avatar
                  name={activeStory.organizer.name}
                  src={activeStory.organizer.logoUrl}
                  size="sm"
                  isVerified={activeStory.organizer.isVerified}
                />
                <div>
                  <div className={styles.viewerClubName}>{activeStory.organizer.name}</div>
                  <div className={styles.viewerMeta}>24h Live Campus Story</div>
                </div>
              </div>
              <button
                type="button"
                className={styles.viewerCloseBtn}
                onClick={onClose}
                aria-label="Close stories"
              >
                ✕
              </button>
            </div>

            {/* Tap Zones + Story Body */}
            <div className={styles.viewerStage}>
              {activeStory.mediaType === 'VIDEO' ? (
                <video
                  key={activeStory.id}
                  src={activeStory.mediaUrl}
                  autoPlay
                  muted
                  playsInline
                  aria-label={activeStory.headline}
                  className={styles.storyMedia}
                />
              ) : (
                <Image
                  src={activeStory.mediaUrl}
                  alt={activeStory.headline}
                  fill
                  unoptimized
                  className={styles.storyMedia}
                />
              )}
              <button
                type="button"
                className={styles.tapZoneLeft}
                aria-label="Previous story"
                onClick={() => {
                  if (activeIndex > 0) onSelectIndex(activeIndex - 1);
                }}
              />
              <button
                type="button"
                className={styles.tapZoneRight}
                aria-label="Next story"
                onClick={() => {
                  if (activeIndex < stories.length - 1) {
                    onSelectIndex(activeIndex + 1);
                  } else {
                    onClose();
                  }
                }}
              />

              <div className={styles.storyContentBox}>
                <Badge variant="live">LIVE ON CAMPUS</Badge>
                <h2 className={styles.storyHeadline}>{activeStory.headline}</h2>
                {activeStory.caption ? (
                  <p className={styles.storyCaption}>{activeStory.caption}</p>
                ) : null}
              </div>
            </div>

            {/* Sticky Bottom Event CTA */}
            {activeStory.eventSlug ? (
              <div className={styles.viewerFooter}>
                <Link
                  href={`/e/${activeStory.eventSlug}`}
                  className={styles.storyEventCta}
                  onClick={onClose}
                >
                  <span>View Event &amp; RSVP →</span>
                  {activeStory.eventTitle ? (
                    <span className={styles.storyEventSub}>{activeStory.eventTitle}</span>
                  ) : null}
                </Link>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
