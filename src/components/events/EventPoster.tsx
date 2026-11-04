'use client';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { EnrichedEvent } from '@/lib/campus-data';
import styles from './HomeFeed.module.css';
export function EventPoster({ event, detail = false }: { event: EnrichedEvent; detail?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutId={reduced ? undefined : `poster-${event.id}`}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={`${styles.posterImage} ${detail ? styles.detailPoster : ''}`}
      aria-hidden="true"
    >
      {event.coverImageUrl ? (
        <Image
          src={event.coverImageUrl}
          alt=""
          fill
          sizes={detail ? '(min-width: 1024px) 700px, 100vw' : '(min-width: 1024px) 420px, 100vw'}
          className={styles.cover}
          unoptimized
        />
      ) : !detail ? (
        <div className={styles.posterFallback}>
          <span>{event.organizer.name}</span>
          <strong>{event.title}</strong>
          <span>University of Ibadan</span>
        </div>
      ) : null}
    </motion.div>
  );
}
