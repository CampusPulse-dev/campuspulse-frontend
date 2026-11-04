'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_LABELS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AccountGate, PageFrame, styles } from './Shared';
function SettingsForm() {
  const { user, privacy, updatePrivacy, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function perform(action: () => Promise<void>) {
    setMessage('');
    setBusy(true);
    try {
      await action();
      setMessage('Changes saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Changes could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={styles.panel}>
        <h2>Your profile</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() => updateProfile(name.trim()));
          }}
          className={styles.list}
        >
          <label className={styles.field}>
            Display name
            <input
              required
              maxLength={80}
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <Button type="submit" isLoading={busy}>
              Save profile
            </Button>
            <Link href="/verify">
              {user?.isVerifiedStudent ? 'Student verified ✓' : 'Verify student status →'}
            </Link>
            <Link href="/onboarding?next=/settings">Edit your persona →</Link>
            <Link href="/settings/creator">Creator dashboard →</Link>
            <Link href="/organizer/apply">Apply for a club →</Link>
          </div>
        </form>
      </section>
      <section className={styles.panel}>
        <h2>Privacy and appearance</h2>
        <label className={styles.field}>
          Theme
          <select
            aria-label="Theme"
            disabled={busy}
            className={styles.input}
            value={privacy.theme}
            onChange={(e) =>
              perform(() => updatePrivacy({ theme: e.target.value as typeof privacy.theme }))
            }
          >
            <option value="system">Use device setting</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            disabled={busy}
            checked={privacy.stealthRsvp}
            onChange={(e) => perform(() => updatePrivacy({ stealthRsvp: e.target.checked }))}
          />
          Keep my RSVPs private
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            disabled={busy}
            checked={privacy.hideFromFriends}
            onChange={(e) => perform(() => updatePrivacy({ hideFromFriends: e.target.checked }))}
          />
          Hide my activity from friends
        </label>
      </section>
      <section className={styles.panel}>
        <h2>Notification preferences</h2>
        <p className={styles.muted}>
          Mute category recommendations. Critical event changes still reach you.
        </p>
        {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
          <label key={id} className={styles.check}>
            <input
              type="checkbox"
              disabled={busy}
              checked={privacy.mutedCategories.includes(id)}
              onChange={(e) =>
                perform(() =>
                  updatePrivacy({
                    mutedCategories: e.target.checked
                      ? [...privacy.mutedCategories, id]
                      : privacy.mutedCategories.filter((v) => v !== id),
                  }),
                )
              }
            />
            Mute {label}
          </label>
        ))}
        <Link href="/notifications">Manage this device’s push notifications →</Link>
      </section>
      {message ? <p role="status">{message}</p> : null}
      <Button variant="secondary" disabled={busy} onClick={() => perform(signOut)}>
        Sign out and clear cached tickets
      </Button>
    </>
  );
}
export function Settings() {
  return (
    <PageFrame title="Make it yours" subtitle="Your profile, your privacy, your campus rhythm.">
      <AccountGate>
        <SettingsForm />
      </AccountGate>
    </PageFrame>
  );
}
