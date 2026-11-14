'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResourceState } from '@/components/attendee/Shared';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import {
  fetchSettings,
  putSetting,
  type PlatformSetting,
  type SettingValue,
} from '@/lib/admin-data';
import { formatWatDateTime } from '@/lib/campus-data';
import { PageHeader, errorMessage } from './AdminBits';
import styles from './Admin.module.css';

export type SettingKind = 'text' | 'number' | 'switch' | 'list';

const KEY_PATTERN = /^[a-z][a-z0-9_.]{1,63}$/;

export function kindOf(value: unknown): SettingKind {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'switch';
  if (Array.isArray(value)) return 'list';
  return 'text';
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Turns what was typed into the value the API accepts, or explains what is wrong with it. */
export function parseSetting(
  key: string,
  kind: SettingKind,
  raw: string,
): { ok: true; value: SettingValue } | { ok: false; field: 'key' | 'value'; message: string } {
  if (!KEY_PATTERN.test(key))
    return {
      ok: false,
      field: 'key',
      message: 'Use lowercase letters, numbers, dots and underscores, like door.grace_hours.',
    };
  const text = raw.trim();
  if (kind === 'number') {
    const value = Number(text);
    if (!text || !Number.isFinite(value))
      return { ok: false, field: 'value', message: 'Enter a number.' };
    return { ok: true, value };
  }
  if (kind === 'switch') {
    if (text !== 'on' && text !== 'off')
      return { ok: false, field: 'value', message: 'Choose on or off.' };
    return { ok: true, value: text === 'on' };
  }
  if (kind === 'list') {
    const value = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (value.length > 50) return { ok: false, field: 'value', message: 'Keep it to 50 items.' };
    if (value.some((part) => part.length > 200))
      return { ok: false, field: 'value', message: 'Each item must be under 200 characters.' };
    return { ok: true, value };
  }
  if (text.length > 2000)
    return { ok: false, field: 'value', message: 'Keep it under 2000 characters.' };
  return { ok: true, value: text };
}

export function SettingsView({
  settings,
  onSave,
}: {
  settings: PlatformSetting[];
  onSave: (key: string, value: SettingValue) => Promise<void>;
}) {
  const { pushToast } = useToast();
  const [key, setKey] = useState('');
  const [kind, setKind] = useState<SettingKind>('text');
  const [raw, setRaw] = useState('');
  const [problem, setProblem] = useState<{
    field: 'key' | 'value' | 'form';
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(setting: PlatformSetting) {
    setKey(setting.key);
    setKind(kindOf(setting.value));
    setRaw(displayValue(setting.value));
    setProblem(null);
  }

  async function save() {
    const parsed = parseSetting(key.trim(), kind, raw);
    if (!parsed.ok) {
      setProblem({ field: parsed.field, message: parsed.message });
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      await onSave(key.trim(), parsed.value);
      pushToast(`Saved ${key.trim()}.`, 'success');
      setKey('');
      setRaw('');
      setKind('text');
    } catch (error) {
      setProblem({ field: 'form', message: errorMessage(error, 'Could not save. Please retry.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Platform" title="Settings">
        Platform-wide switches and limits. Changes apply immediately and are written to the audit
        log.
      </PageHeader>

      {settings.length === 0 ? (
        <p className={styles.empty}>No settings have been saved yet. Defaults are in use.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Value</th>
                <th scope="col">Last changed</th>
                <th scope="col">
                  <span className={styles.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.key}>
                  <th scope="row" className={styles.mono}>
                    {setting.key}
                  </th>
                  <td className={styles.mono}>{displayValue(setting.value)}</td>
                  <td className={styles.mono}>
                    {formatWatDateTime(setting.updatedAt).compactLabel} WAT
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit ${setting.key}`}
                      onClick={() => edit(setting)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        noValidate
        className={styles.formPanel}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2>Add or change a setting</h2>
        <TextField
          label="Key"
          autoComplete="off"
          spellCheck={false}
          value={key}
          error={problem?.field === 'key' ? problem.message : null}
          onChange={(event) => setKey(event.target.value)}
        />
        <SelectField
          label="Type"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as SettingKind);
            setRaw('');
          }}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="switch">On / off</option>
          <option value="list">List</option>
        </SelectField>
        {kind === 'switch' ? (
          <SelectField
            label="Value"
            value={raw}
            error={problem?.field === 'value' ? problem.message : null}
            onChange={(event) => setRaw(event.target.value)}
          >
            <option value="">Choose…</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </SelectField>
        ) : (
          <TextField
            label="Value"
            autoComplete="off"
            inputMode={kind === 'number' ? 'decimal' : undefined}
            hint={kind === 'list' ? 'Separate items with commas.' : undefined}
            value={raw}
            error={problem?.field === 'value' ? problem.message : null}
            onChange={(event) => setRaw(event.target.value)}
          />
        )}
        {problem?.field === 'form' ? (
          <p role="alert" className={styles.error}>
            {problem.message}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" isLoading={busy}>
            Save setting
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Settings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: fetchSettings });
  if (!settings.data)
    return (
      <ResourceState pending={settings.isPending} error={settings.error} retry={settings.refetch} />
    );
  return (
    <SettingsView
      settings={settings.data}
      onSave={async (key, value) => {
        await putSetting(key, value);
        await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      }}
    />
  );
}
