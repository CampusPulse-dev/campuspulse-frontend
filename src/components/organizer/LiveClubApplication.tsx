'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, type Schemas } from '@/lib/api';
import { useMyClubs } from '@/lib/organizer-data';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import styles from './Organizer.module.css';

export function LiveClubApplication() {
  const mine = useMyClubs();
  const queries = useQueryClient();
  const [result, setResult] = useState<Schemas['OrganizerMembership'] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const owned =
    result ?? (mine.status === 'ready' ? mine.clubs.find((c) => c.role === 'OWNER') : null);
  return (
    <div className={styles.page}>
      <h1>Apply for your club</h1>
      {owned ? (
        <section className={styles.banner} role="status">
          <h2>{owned.organizer.isVerified ? 'Club verified' : 'Application submitted'}</h2>
          <p>{owned.organizer.name}</p>
          <Link href={`/organizer/${owned.organizer.slug}`}>Open club dashboard</Link>
        </section>
      ) : (
        <form
          className={styles.stepSection}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const body: Schemas['SubmitOrganizerVerificationBody'] = {
                organizerName: name.trim(),
                slug: slug.trim(),
                evidenceUrl: evidence.trim(),
                note: null,
              };
              setResult(
                await apiFetch<Schemas['OrganizerMembership']>('/organizers', {
                  method: 'POST',
                  body: JSON.stringify(body),
                }),
              );
              await queries.invalidateQueries({ queryKey: ['my-organizers'] });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Application failed. Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextField
            label="Club name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Club link"
            hint="Lowercase words separated by hyphens, such as ui-drama-society."
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <TextField
            label="Verification evidence URL"
            type="url"
            required
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            hint="Official university registration or a public club affiliation link. Do not upload student IDs here."
          />
          <Button type="submit" isLoading={busy} disabled={mine.status === 'loading'}>
            Submit application
          </Button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
