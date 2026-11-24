'use client';
import { X } from 'lucide-react';
import { Icon } from './Icon';
import { useEffect, useId, useRef, useState } from 'react';
import { useDialog } from '@/lib/use-dialog';
import styles from './Modal.module.css';
export interface ModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}
export function Modal({ isOpen, title, subtitle, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const subtitleId = useId();
  useDialog(isOpen, ref, onClose);
  // Match the CSS exit duration even when animation events don't fire.
  const [rendered, setRendered] = useState(isOpen);
  if (isOpen && !rendered) setRendered(true);
  const closing = rendered && !isOpen;
  useEffect(() => {
    if (!closing) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(() => setRendered(false), 0);
      return () => window.clearTimeout(timer);
    }
    const duration = getComputedStyle(document.documentElement).getPropertyValue('--dur-modal-out');
    const timer = window.setTimeout(() => setRendered(false), Number.parseFloat(duration) || 180);
    return () => window.clearTimeout(timer);
  }, [closing]);
  if (!rendered) return null;
  return (
    <div
      className={`${styles.portal} ${closing ? styles.closing : ''}`}
      inert={closing || undefined}
    >
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={styles.sheet}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) setRendered(false);
        }}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? (
              <p id={subtitleId} className={styles.subtitle}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <Icon icon={X} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
