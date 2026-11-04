'use client';
import { useState } from 'react';
import { UserRound, ShieldCheck, Sparkles, Building2, Mic2 } from 'lucide-react';
import { TextField, SelectField, ToggleRow } from '@/components/ui/Field';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
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
      <Section title="Your profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() => updateProfile(name.trim()));
          }}
          className={styles.list}
        >
          <TextField
            label="Display name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          onChange={(e) =>
            perform(() => updatePrivacy({ theme: e.target.value as typeof privacy.theme }))
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
          onChange={(e) => perform(() => updatePrivacy({ stealthRsvp: e.target.checked }))}
        />
        <ToggleRow
          label="Hide my activity from friends"
          disabled={busy}
          checked={privacy.hideFromFriends}
          onChange={(e) => perform(() => updatePrivacy({ hideFromFriends: e.target.checked }))}
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
        ))}
        <ListRow title="This device’s push notifications" href="/notifications" />
      </Section>
      {message ? <p role="status">{message}</p> : null}
      <Button variant="ghostDanger" disabled={busy} onClick={() => perform(signOut)}>
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
