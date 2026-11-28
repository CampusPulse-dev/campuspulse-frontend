'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { PulseSceneController } from './pulse-scene-engine';
import styles from './PulseScene.module.css';

/**
 * A slow, glowing C + Pulse mark in 3-D. Decorative only: Babylon.js loads in
 * one lazy chunk after the page is interactive, the canvas is hidden from
 * assistive tech, and anyone who prefers reduced motion (or has no WebGL)
 * gets the static gradient underneath instead.
 */
export function PulseScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PulseSceneController | null>(null);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Hidden (e.g. the auth panel on phones): never download the engine.
    if (canvas.getClientRects().length === 0) return;
    let disposed = false;

    void import('./pulse-scene-engine')
      .then(({ mountPulseScene }) => {
        if (disposed) return;
        controllerRef.current = mountPulseScene(canvas);
        if (controllerRef.current) setLive(true);
      })
      .catch(() => {
        // Chunk failed to load (e.g. offline): the static gradient stays.
      });

    return () => {
      disposed = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return (
    <div className={styles.stage} data-live={live || undefined}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" tabIndex={-1} />
      {live ? (
        <Button
          variant="secondary"
          size="sm"
          className={styles.motionButton}
          onClick={() => {
            controllerRef.current?.setPaused(!paused);
            setPaused(!paused);
          }}
        >
          {paused ? 'Resume animation' : 'Pause animation'}
        </Button>
      ) : null}
    </div>
  );
}
