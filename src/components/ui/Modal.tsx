'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bottomSheetVariants, modalBackdropVariants } from '@/lib/motion';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, title, subtitle, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className={styles.portal}>
          <motion.div
            className={styles.backdrop}
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={styles.sheet}
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
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
                ✕
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
