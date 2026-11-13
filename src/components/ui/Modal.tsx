'use client';
import { X } from 'lucide-react';
import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
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
  useDialog(isOpen, ref, onClose);
  // Stay mounted for the 160 ms exit animation after the parent closes us.
  const [rendered, setRendered] = useState(isOpen);
  if (isOpen && !rendered) setRendered(true);
  const closing = rendered && !isOpen;
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(false), 160);
    return () => window.clearTimeout(timer);
  }, [closing]);
  if (!rendered) return null;
  return (
    <div className={`${styles.portal} ${closing ? styles.closing : ''}`}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.sheet}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
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
