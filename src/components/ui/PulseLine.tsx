'use client';
import { useEffect, useId, useRef, type CSSProperties } from 'react';
import styles from './PulseLine.module.css';

// The two ECG peaks follow the relative geometry of public/brand/logo.svg.
const PATH = 'M0 36H92L112 7L151 66L168 36H320';

/** Deterministic 0–1 phase from React's id, so SSR and hydration agree. */
function phaseFrom(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1)
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return (hash % 1000) / 1000;
}

export function PulseLine({
  animated = false,
  beating = false,
  size = 'md',
  className = '',
}: {
  /** Draw the line in once on first paint. */
  animated?: boolean;
  /** Sweep a glowing trace along the line on a loop (paused while off screen). */
  beating?: boolean;
  /** `sm` is the 32×12 live-event mark; it always beats unless motion is reduced. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const id = useId();
  const small = size === 'sm';
  const beats = beating || small;

  // Pause the loop while the line is off screen (skill: loops pause off screen).
  useEffect(() => {
    const element = ref.current;
    if (!beats || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.paused = entry && entry.isIntersecting ? 'false' : 'true';
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [beats]);

  // Offset each small mark's phase so a feed of live cards doesn't beat in lockstep.
  const style = small ? ({ '--pulse-phase': phaseFrom(id) } as CSSProperties) : undefined;

  return (
    <svg
      ref={ref}
      className={[
        styles.pulse,
        small ? styles.sm : '',
        animated ? styles.draw : '',
        beats ? styles.beating : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      viewBox="0 0 320 72"
      fill="none"
      aria-hidden="true"
    >
      <path
        className={styles.base}
        d={PATH}
        pathLength="1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {beats ? (
        <path
          className={styles.trace}
          d={PATH}
          pathLength="1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
