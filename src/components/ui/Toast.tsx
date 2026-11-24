'use client';

import { X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './Feedback.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';
/** Why a toast went away: its time ran out, the person closed it, or they took its action. */
export type ToastCloseReason = 'timeout' | 'dismiss' | 'action';

export interface ToastOptions {
  tone?: ToastTone;
  /** One button, such as Undo. A toast with an action stays at least 6 s. */
  action?: { label: string; onClick: () => void };
  /** How long it stays, in ms; paused while hovered or focused. */
  duration?: number;
  /** Runs once when it goes away, with the reason. Deferred commits hang off this. */
  onClose?: (reason: ToastCloseReason) => void;
}

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastOptions['action'];
  leaving: boolean;
}

interface ToastContextValue {
  /** The second argument may be a tone (the original signature) or options. */
  pushToast: (message: string, options?: ToastTone | ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const DEFAULT_MS = 4000;
const WITH_ACTION_MS = 6000;

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => '',
  dismissToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

interface Timer {
  remaining: number;
  startedAt: number;
  handle: number | null;
  onClose?: ToastOptions['onClose'];
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, Timer>());
  const paused = useRef(false);
  const engaged = useRef({ pointer: false, focus: false });

  const close = useCallback((id: string, reason: ToastCloseReason) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    if (timer.handle !== null) window.clearTimeout(timer.handle);
    timers.current.delete(id);
    if (timers.current.size === 0) {
      paused.current = false;
      engaged.current = { pointer: false, focus: false };
    }
    timer.onClose?.(reason);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    const duration = getComputedStyle(document.documentElement).getPropertyValue('--dur-modal-out');
    window.setTimeout(
      () => setToasts((prev) => prev.filter((item) => item.id !== id)),
      Number.parseFloat(duration) || 180,
    );
  }, []);

  const start = useCallback(
    (id: string) => {
      const timer = timers.current.get(id);
      if (!timer || timer.handle !== null) return;
      timer.startedAt = Date.now();
      timer.handle = window.setTimeout(() => close(id, 'timeout'), timer.remaining);
    },
    [close],
  );

  const pushToast = useCallback(
    (message: string, options?: ToastTone | ToastOptions) => {
      const opts: ToastOptions = typeof options === 'string' ? { tone: options } : (options ?? {});
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duration = Math.max(opts.duration ?? 0, opts.action ? WITH_ACTION_MS : DEFAULT_MS);
      timers.current.set(id, {
        remaining: duration,
        startedAt: 0,
        handle: null,
        onClose: opts.onClose,
      });
      setToasts((prev) => [
        ...prev,
        { id, message, tone: opts.tone ?? 'info', action: opts.action, leaving: false },
      ]);
      if (!paused.current) start(id);
      return id;
    },
    [start],
  );

  const dismissToast = useCallback((id: string) => close(id, 'dismiss'), [close]);

  // Hold every toast while the pointer or focus is on the stack, so nobody
  // loses an Undo while reaching for it.
  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    const now = Date.now();
    timers.current.forEach((timer) => {
      if (timer.handle === null) return;
      window.clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    });
  }, []);
  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    timers.current.forEach((_, id) => start(id));
  }, [start]);

  // A deferred action must not be lost if the tab closes: settle every open
  // toast as timed out once the page is hidden.
  useEffect(() => {
    const settle = () => Array.from(timers.current.keys()).forEach((id) => close(id, 'timeout'));
    const onVisibility = () => {
      if (document.hidden) settle();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', settle);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', settle);
    };
  }, [close]);

  function engage(kind: 'pointer' | 'focus', value: boolean) {
    engaged.current[kind] = value;
    if (engaged.current.pointer || engaged.current.focus) pause();
    else resume();
  }

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <div
        className={styles.toastViewport}
        aria-live="polite"
        aria-atomic="false"
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') engage('pointer', true);
        }}
        onPointerLeave={() => engage('pointer', false)}
        onFocus={() => engage('focus', true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            engage('focus', false);
        }}
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`${styles.toast} ${styles[`tone-${item.tone}`]} ${
              item.leaving ? styles.toastLeaving : ''
            }`}
            inert={item.leaving || undefined}
          >
            <span className={styles.toastMessage}>{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  item.action?.onClick();
                  close(item.id, 'action');
                }}
              >
                {item.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.toastClose}
              aria-label="Dismiss notification"
              onClick={() => close(item.id, 'dismiss')}
            >
              <Icon icon={X} size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
