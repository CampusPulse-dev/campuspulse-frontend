'use client';
import { useState } from 'react';
import { UserRound, ShieldCheck, Sparkles, Building2, Mic2 } from 'lucide-react';
import { TextField, SelectField, ToggleRow } from '@/components/ui/Field';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_LABELS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccountGate, PageFrame, styles } from './Shared';
import feedback from '@/components/ui/Feedback.module.css';
function SettingsForm() {
  const { user, privacy, updatePrivacy, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  // The status shows beside the control that changed, not at the page bottom.
  const [status, setStatus] = useState<{ key: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Every control stays disabled while one saves: preferences are written as
  // one object, so two overlapping saves could undo each other.
  async function perform(key: string, action: () => Promise<void>) {
    setStatus({ key, text: 'Saving…' });
    setBusy(true);
    try {
      await action();
      setStatus({ key, text: 'Saved' });
    } catch (e) {
      setStatus({ key, text: e instanceof Error ? e.message : 'Could not save. Try again.' });
    } finally {
      setBusy(false);
    }
  }
  const hintFor = (key: string) => (status?.key === key ? status.text : undefined);
  return (
    <>
      <Section title="Your profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform('profile', () => updateProfile(name.trim()));
          }}
          className={styles.list}
        >
          <TextField
            label="Display name"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint={hintFor('profile')}
          />
          <div className={styles.actions}>
            <Button type="submit" isLoading={busy}>
              Save profile
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Account">
        <ListRow
          icon={user?.isVerifiedStudent ? ShieldCheck : UserRound}
          title="Student verification"
          meta={user?.isVerifiedStudent ? 'Verified UI student' : 'Verify your student status'}
          href="/verify"
        />
        <ListRow icon={Sparkles} title="Edit your persona" href="/onboarding?next=/settings" />
        <ListRow icon={Mic2} title="Creator dashboard" href="/settings/creator" />
        <ListRow icon={Building2} title="Apply for a club" href="/organizer/apply" />
      </Section>
      <Section title="Privacy and appearance">
        <SelectField
          label="Theme"
          aria-label="Theme"
          disabled={busy}
          value={privacy.theme}
          hint={hintFor('theme')}
          onChange={(e) =>
            perform('theme', () => updatePrivacy({ theme: e.target.value as typeof privacy.theme }))
          }
        >
          <option value="system">Use device setting</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </SelectField>
        <ToggleRow
          label="Keep my RSVPs private"
          disabled={busy}
          checked={privacy.stealthRsvp}
          hint={hintFor('stealth')}
          onChange={(e) =>
            perform('stealth', () => updatePrivacy({ stealthRsvp: e.target.checked }))
          }
        />
        <ToggleRow
          label="Hide my activity from friends"
          disabled={busy}
          checked={privacy.hideFromFriends}
          hint={hintFor('hide')}
          onChange={(e) =>
            perform('hide', () => updatePrivacy({ hideFromFriends: e.target.checked }))
          }
        />
      </Section>
      <Section
        title="Notification preferences"
        description="Mute category recommendations. Critical event changes still reach you."
      >
        {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
          <ToggleRow
            key={id}
            label={`Mute ${label}`}
            disabled={busy}
            checked={privacy.mutedCategories.includes(id)}
            hint={hintFor(`mute-${id}`)}
            onChange={(e) =>
              perform(`mute-${id}`, () =>
                updatePrivacy({
                  mutedCategories: e.target.checked
                    ? [...privacy.mutedCategories, id]
                    : privacy.mutedCategories.filter((v) => v !== id),
                }),
              )
            }
          />
        ))}
        <ListRow title="This device’s push notifications" href="/notifications" />
      </Section>
      <p role="status" className={feedback.visuallyHidden}>
        {status?.text ?? ''}
      </p>
      <Button variant="ghostDanger" disabled={busy} onClick={() => setConfirmingSignOut(true)}>
        Sign out and clear cached tickets
      </Button>
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out?"
        subtitle="Your saved QR passes are removed from this device. You'll need a connection to get them back before the door."
        confirmLabel="Sign out"
        onConfirm={signOut}
        onClose={() => setConfirmingSignOut(false)}
      />
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
