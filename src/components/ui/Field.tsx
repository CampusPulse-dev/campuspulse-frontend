'use client';

import React, { useId } from 'react';
import styles from './Field.module.css';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
}

function describedBy(id: string, hint?: string, error?: string | null) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function Shell({
  id,
  label,
  hint,
  error,
  children,
}: FieldShellProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = FieldShellProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, hint, error, className = '', ...props }: TextFieldProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={`${styles.control} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Shell>
  );
}

export type TextAreaProps = FieldShellProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextArea({ label, hint, error, className = '', ...props }: TextAreaProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={4}
        className={`${styles.control} ${styles.textarea} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Shell>
  );
}

export type SelectFieldProps = FieldShellProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

export function SelectField({
  label,
  hint,
  error,
  className = '',
  children,
  ...props
}: SelectFieldProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={`${styles.control} ${styles.select} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </Shell>
  );
}

export interface ToggleRowProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
}

export function ToggleRow({ label, hint, className = '', ...props }: ToggleRowProps) {
  const id = useId();
  return (
    <div className={styles.toggleRow}>
      <input
        id={id}
        type="checkbox"
        className={`${styles.checkbox} ${className}`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div>
        <label htmlFor={id} className={styles.toggleLabel}>
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
