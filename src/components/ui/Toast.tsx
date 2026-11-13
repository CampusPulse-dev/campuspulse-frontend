'use client';

import { usePathname } from 'next/navigation';
import React, { createContext, useCallback, useContext, useState } from 'react';
import styles from './Feedback.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  path: string | null;
  leaving?: boolean;
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
      // Fade out over the last 160 ms, then drop it.
      window.setTimeout(() => {
        setToasts((prev) =>
          prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
        );
      }, 3240);
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
        {toasts
          .filter((item) => item.path === pathname)
          .map((item) => (
            <div
              key={item.id}
              className={`${styles.toast} ${styles[`tone-${item.tone}`]} ${
                item.leaving ? styles.toastLeaving : ''
              }`}
            >
              <span>{item.message}</span>
            </div>
          ))}
      </div>
    </ToastContext.Provider>
  );
}
