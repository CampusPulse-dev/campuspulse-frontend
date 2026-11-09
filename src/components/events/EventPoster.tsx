'use client';
import { useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { EnrichedEvent } from '@/lib/campus-data';
import styles from './HomeFeed.module.css';
export function EventPoster({ event, detail = false }: { event: EnrichedEvent; detail?: boolean }) {
  const reduced = useReducedMotion();
  // A cover that fails to load falls back to the branded poster instead of a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cover =
    event.coverImageUrl && failedSrc !== event.coverImageUrl ? event.coverImageUrl : null;
  return (
    <motion.div
      layoutId={reduced ? undefined : `poster-${event.id}`}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={`${styles.posterImage} ${detail ? styles.detailPoster : ''}`}
      aria-hidden="true"
    >
      {cover ? (
        <Image
          src={cover}
          alt=""
          fill
          sizes={detail ? '(min-width: 1024px) 700px, 100vw' : '(min-width: 1024px) 420px, 100vw'}
          className={styles.cover}
          onError={() => setFailedSrc(cover)}
          unoptimized
        />
      ) : detail ? (
        // The detail hero already overlays the title, so the fallback is the gradient alone.
        <div className={styles.posterFallback} />
      ) : (
        <div className={styles.posterFallback}>
          <span>{event.organizer.name}</span>
          <strong>{event.title}</strong>
          <span>University of Ibadan</span>
        </div>
      )}
    </motion.div>
  );
}
