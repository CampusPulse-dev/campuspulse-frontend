'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NOTE_MAX, validateNote } from '@/lib/admin-data';
import styles from './Admin.module.css';

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** A clock that ticks once a second, for lock countdowns and waiting times. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** True while focus is somewhere that should receive plain letter keys itself. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="dialog"]') !== null
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1>{title}</h1>
      {children ? <p className={styles.lede}>{children}</p> : null}
    </header>
  );
}

export interface ConfirmRequest {
  title: string;
  subtitle?: string;
  confirmLabel: string;
  danger?: boolean;
  /** `none` hides the field; `required` blocks confirm until something is written. */
  note: 'none' | 'optional' | 'required';
  noteLabel?: string;
  run: (note: string | null) => Promise<void>;
}

/**
 * Every admin decision goes through this: one modal, one explicit confirm, and
 * a note where the server requires one. There is deliberately no undo.
 */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setNote('');
    setProblem(null);
    onClose();
  }

  async function confirm() {
    if (!request) return;
    const invalid =
      request.note === 'none' ? null : validateNote(note, request.note === 'required');
    setProblem(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      await request.run(request.note === 'none' ? null : note.trim() || null);
      setNote('');
      setProblem(null);
      onClose();
    } catch (error) {
      setProblem(errorMessage(error, 'That did not go through. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={request !== null}
      title={request?.title ?? ''}
      subtitle={request?.subtitle}
      onClose={close}
    >
      <form
        noValidate
        className={styles.page}
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        {request && request.note !== 'none' ? (
          <TextArea
            label={request.noteLabel ?? 'Note'}
            value={note}
            maxLength={NOTE_MAX}
            error={problem}
            onChange={(event) => setNote(event.target.value)}
          />
        ) : problem ? (
          <p role="alert" className={styles.error}>
            {problem}
          </p>
        ) : null}
        <div className={`${styles.actions} ${styles.actionsEnd}`}>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={request?.danger ? 'danger' : 'primary'} isLoading={busy}>
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
