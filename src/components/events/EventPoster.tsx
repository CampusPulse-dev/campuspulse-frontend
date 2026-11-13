'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { EnrichedEvent } from '@/lib/campus-data';
import { isOptimizableImage } from '@/lib/media';
import styles from './HomeFeed.module.css';
export function EventPoster({ event, detail = false }: { event: EnrichedEvent; detail?: boolean }) {
  // A cover that fails to load falls back to the branded poster instead of a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cover =
    event.coverImageUrl && failedSrc !== event.coverImageUrl ? event.coverImageUrl : null;
  return (
    <div
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
          // The detail hero is the page's largest paint: fetch it first, never lazily.
          preload={detail}
          fetchPriority={detail ? 'high' : undefined}
          onError={() => setFailedSrc(cover)}
          unoptimized={!isOptimizableImage(cover)}
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
    </div>
  );
}
