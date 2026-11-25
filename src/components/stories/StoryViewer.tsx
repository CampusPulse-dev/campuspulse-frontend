'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Pause, Play, X } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import type { EnrichedStory } from '@/lib/campus-data';
import Image from 'next/image';
import { useDialog } from '@/lib/use-dialog';
import styles from './Stories.module.css';
import { motionDuration, motionEase } from '@/lib/motion';

const STORY_MS = 5000;

const StoryOverlay = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  function StoryOverlay(props, ref) {
    const present = useIsPresent();
    return (
      <motion.div
        {...props}
        ref={ref}
        inert={!present || undefined}
        aria-hidden={!present || undefined}
      />
    );
  },
);

export interface StoryViewerProps {
  stories: EnrichedStory[];
  activeIndex: number | null;
  onSelectIndex: (nextIndex: number) => void;
  onClose: () => void;
}

export function StoryViewer({ stories, activeIndex, onSelectIndex, onClose }: StoryViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const progress = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const callbacks = useRef({ onSelectIndex, onClose });
  useEffect(() => {
    callbacks.current = { onSelectIndex, onClose };
  }, [onSelectIndex, onClose]);
  const pressedAt = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const stopped = paused || holding || hidden;
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, stories.length, onSelectIndex, onClose]);
  useEffect(() => {
    elapsed.current = 0;
    if (progress.current) progress.current.style.transform = 'scaleX(0)';
  }, [activeStory?.id]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (activeIndex === null || stopped) return;
    const started = performance.now() - elapsed.current;
    const elapsedSinceStart = () => Math.min(STORY_MS, performance.now() - started);
    let frame = 0;
    function draw() {
      const time = elapsedSinceStart();
      if (progress.current) progress.current.style.transform = `scaleX(${time / STORY_MS})`;
      if (time < STORY_MS) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    const timer = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      if (progress.current) progress.current.style.transform = 'scaleX(1)';
      if (activeIndex < stories.length - 1) callbacks.current.onSelectIndex(activeIndex + 1);
      else callbacks.current.onClose();
    }, STORY_MS - elapsed.current);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      elapsed.current = elapsedSinceStart();
    };
  }, [activeIndex, activeStory?.id, stories.length, stopped]);
  useEffect(() => {
    if (!video.current) return;
    if (stopped) video.current.pause();
    else void video.current.play().catch(() => {});
  }, [stopped, activeStory?.id]);

  return (
    <AnimatePresence>
      {activeStory && activeIndex !== null ? (
        <StoryOverlay
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${activeStory.organizer.name} Story`}
          className={styles.viewerOverlay}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: reduced ? 0 : motionDuration.popover, ease: motionEase.in },
          }}
          transition={{ duration: reduced ? 0 : motionDuration.popover, ease: motionEase.out }}
          drag={reduced ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.8 }}
          dragMomentum={false}
          dragTransition={{ bounceStiffness: 350, bounceDamping: 38 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || (info.offset.y >= 0 && info.velocity.y > 500)) {
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
                    key={activeStory.id}
                    ref={idx === activeIndex ? progress : undefined}
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
              <div className={styles.viewerControls}>
                <button
                  type="button"
                  className={styles.viewerCloseBtn}
                  aria-label={paused ? 'Resume stories' : 'Pause stories'}
                  aria-pressed={paused}
                  onClick={() => setPaused((value) => !value)}
                >
                  <Icon icon={paused ? Play : Pause} />
                </button>
                <button
                  type="button"
                  className={styles.viewerCloseBtn}
                  onClick={onClose}
                  aria-label="Close stories"
                >
                  <Icon icon={X} />
                </button>
              </div>
            </div>

            {/* Tap Zones + Story Body */}
            <div
              className={styles.viewerStage}
              onPointerDown={() => {
                pressedAt.current = performance.now();
                setHolding(true);
              }}
              onPointerUp={() => setHolding(false)}
              onPointerCancel={() => setHolding(false)}
              onPointerLeave={() => setHolding(false)}
            >
              {activeStory.mediaType === 'VIDEO' ? (
                <video
                  ref={video}
                  key={activeStory.id}
                  src={activeStory.mediaUrl}
                  autoPlay={!stopped}
                  controls={Boolean(reduced)}
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
                onClick={(event) => {
                  if (event.detail !== 0 && performance.now() - pressedAt.current > 180) return;
                  if (activeIndex > 0) onSelectIndex(activeIndex - 1);
                }}
              />
              <button
                type="button"
                className={styles.tapZoneRight}
                aria-label="Next story"
                onClick={(event) => {
                  if (event.detail !== 0 && performance.now() - pressedAt.current > 180) return;
                  if (activeIndex < stories.length - 1) {
                    onSelectIndex(activeIndex + 1);
                  } else {
                    onClose();
                  }
                }}
              />

              <div className={styles.storyContentBox}>
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
        </StoryOverlay>
      ) : null}
    </AnimatePresence>
  );
}
