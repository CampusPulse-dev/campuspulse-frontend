'use client';

import React, { useId } from 'react';
import styles from './Field.module.css';

interface FieldShellProps {
  label: React.ReactNode;
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
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & { ref?: React.Ref<HTMLInputElement> };

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
  label: React.ReactNode;
  hint?: string;
}

export function ToggleRow({ label, hint, className = '', ...props }: ToggleRowProps) {
  const id = useId();
  return (
    <label className={styles.toggleRow} htmlFor={id}>
      <span className={styles.toggleCopy}>
        <span id={id + '-label'} className={styles.toggleLabel}>
          {label}
        </span>
        {hint ? (
          <span id={id + '-hint'} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </span>
      <span className={styles.switchControl}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-labelledby={id + '-label'}
          className={styles.switchInput + ' ' + className}
          aria-describedby={hint ? id + '-hint' : undefined}
          {...props}
        />
        <span className={styles.switchTrack} aria-hidden="true" />
      </span>
    </label>
  );
}
