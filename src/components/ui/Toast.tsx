'use client';

import { usePathname } from 'next/navigation';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import styles from './Feedback.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  path: string | null;
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, tone, path: pathname }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3400);
    },
    [pathname],
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts
            .filter((item) => item.path === pathname)
            .map((item) => (
              <motion.div
                key={item.id}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={`${styles.toast} ${styles[`tone-${item.tone}`]}`}
              >
                <span>{item.message}</span>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
