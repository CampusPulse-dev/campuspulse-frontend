'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { errorMessage } from './AdminBits';
import styles from './Admin.module.css';

const MAX_WIDTH = 1400;

/**
 * Draws the image and bakes the reviewer's identity into the pixels, so any
 * screenshot or photo of the screen says who was looking and when.
 */
export function paintDocument(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource & { naturalWidth: number; naturalHeight: number },
  watermark: string,
): boolean {
  const context = canvas.getContext('2d');
  if (!context || !image.naturalWidth) return false;
  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const size = Math.max(13, Math.round(width / 46));
  context.save();
  context.font = `600 ${size}px sans-serif`;
  context.translate(width / 2, height / 2);
  context.rotate(-Math.PI / 7);
  const stepX = context.measureText(watermark).width + size * 3;
  const stepY = size * 5;
  const reach = Math.hypot(width, height);
  for (let y = -reach, line = 0; y < reach; y += stepY, line += 1) {
    for (let x = -reach - (line % 2) * (stepX / 2); x < reach; x += stepX) {
      // Light halo then dark text: legible over both pale and dark documents.
      context.fillStyle = 'rgba(255, 255, 255, 0.28)';
      context.fillText(watermark, x + 1, y + 1);
      context.fillStyle = 'rgba(16, 0, 43, 0.3)';
      context.fillText(watermark, x, y);
    }
  }
  context.restore();
  return true;
}

function wipe(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

type Phase = 'idle' | 'loading' | 'shown';

/**
 * NDPA: a student ID is never given a URL, never cached and never left on
 * screen. The bytes go from memory straight onto a watermarked canvas, the
 * blob URL is revoked as soon as it is drawn, and the canvas is wiped when the
 * reviewer hides it, switches tab, loses the claim or decides.
 */
export function EphemeralIdViewer({
  load,
  watermark,
}: {
  /** Each call is one audited view on the server. Only made on an explicit click. */
  load: () => Promise<Blob>;
  watermark: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const hide = useCallback(() => {
    generation.current += 1;
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    pendingUrl.current = null;
    wipe(canvasRef.current);
    setPhase('idle');
  }, []);

  useEffect(() => {
    alive.current = true;
    const canvas = canvasRef.current;
    const onVisibility = () => {
      if (document.hidden) hide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive.current = false;
      generation.current += 1;
      if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
      pendingUrl.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      wipe(canvas);
    };
  }, [hide]);

  async function show() {
    const request = ++generation.current;
    const current = () => alive.current && generation.current === request && !document.hidden;
    setProblem(null);
    setPhase('loading');
    let url: string | null = null;
    try {
      const blob = await load();
      if (!current()) return;
      url = URL.createObjectURL(blob);
      pendingUrl.current = url;
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('This image could not be displayed.'));
        image.src = url as string;
      });
      if (!current() || !canvasRef.current) return;
      if (!paintDocument(canvasRef.current, image, watermark))
        throw new Error('This image could not be displayed.');
      setPhase('shown');
    } catch (error) {
      if (!current()) return;
      wipe(canvasRef.current);
      setPhase('idle');
      setProblem(errorMessage(error, 'Could not load the ID image. Please retry.'));
    } finally {
      if (url && pendingUrl.current === url) {
        URL.revokeObjectURL(url);
        pendingUrl.current = null;
      }
    }
  }

  return (
    <div className={styles.viewer}>
      <p className={styles.viewerNotice}>
        <Icon icon={Eye} size={16} />
        <span>
          Viewing is logged against your account each time. The image is watermarked and is deleted
          as soon as you decide.
        </span>
      </p>
      {problem ? (
        <p role="alert" className={styles.error}>
          {problem}
        </p>
      ) : null}
      <div
        className={styles.canvasWrap}
        hidden={phase !== 'shown'}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label="Student ID image, watermarked"
        />
      </div>
      <div className={styles.actions}>
        {phase === 'shown' ? (
          <Button variant="secondary" onClick={hide}>
            Hide image
          </Button>
        ) : (
          <Button variant="secondary" isLoading={phase === 'loading'} onClick={() => void show()}>
            View ID image
          </Button>
        )}
      </div>
    </div>
  );
}
