'use client';
import { X } from 'lucide-react';
import { Icon } from './Icon';
import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bottomSheetVariants, modalBackdropVariants } from '@/lib/motion';
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
            ref={ref}
            tabIndex={-1}
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
                <Icon icon={X} />
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
