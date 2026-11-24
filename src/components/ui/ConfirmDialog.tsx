'use client';
import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './ConfirmDialog.module.css';

/**
 * Confirmation for an action that can't be undone. Cancel takes the default
 * focus, so Enter or a habitual click never runs the destructive verb; the
 * confirm button names that verb and is never larger than Cancel.
 */
export function ConfirmDialog({
  open,
  title,
  subtitle,
  confirmLabel,
  danger = true,
  disabled = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Blocks confirm, e.g. until a required reason is written. */
  disabled?: boolean;
  /** Resolve to close; throw to keep the dialog open and show the message. */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setProblem(null);
    onClose();
  }

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setProblem(
        error instanceof Error && error.message
          ? error.message
          : 'That did not go through. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={open} title={title} subtitle={subtitle} onClose={close}>
      <div className={styles.body}>
        {children}
        {problem ? (
          <p role="alert" className={styles.error}>
            {problem}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={close} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            isLoading={busy}
            disabled={disabled}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
