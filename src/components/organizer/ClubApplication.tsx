'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { readLocal, writeLocal } from '@/lib/attendee-data';
import { DEMO_MODE } from '@/lib/mode';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import styles from './Organizer.module.css';

type Application = { name: string; description: string; evidence: string };

function ApplicationForm({ userId }: { userId: string }) {
  const key = `organizer:application:${userId}`;
  const [application, setApplication] = useState<Application | null>(() => readLocal(key, null));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !evidence.trim()) return;
    const next = { name: name.trim(), description: description.trim(), evidence: evidence.trim() };
    try {
      writeLocal(key, next);
      setApplication(next);
    } catch {
      setError('Could not save on this device. Check browser storage and try again.');
    }
  }
  return (
    <div className={styles.page}>
      <h1>Apply for your club</h1>
      <p>
        Demo only: your application stays in this browser on this device. It is not sent for review.
      </p>
      {application ? (
        <section className={styles.banner} role="status">
          <h2>Pending review (demo)</h2>
          <p>{application.name}</p>
          <p>No real review is taking place.</p>
          <Button
            onClick={() => {
              setName(application.name);
              setDescription(application.description);
              setEvidence(application.evidence);
              setApplication(null);
            }}
          >
            Edit application
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className={styles.stepSection}>
          <TextField
            label="Club name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextArea
            label="About your club"
            required
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextArea
            label="Club verification evidence"
            hint="Describe your club’s university affiliation or leadership approval. Do not include identity documents."
            required
            maxLength={2000}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
          {error ? <p role="alert">{error}</p> : null}
          <Button type="submit">Save demo application</Button>
        </form>
      )}
    </div>
  );
}

export function ClubApplication() {
  const { user, ready } = useAuth();
  if (!ready) return <p role="status">Checking your account…</p>;
  if (!user)
    return (
      <div className={styles.page}>
        <h1>Sign in to apply</h1>
        <Link href="/sign-in?next=%2Forganizer%2Fapply">Sign in</Link>
      </div>
    );
  if (!DEMO_MODE)
    return (
      <div className={styles.page}>
        <h1>Applications are not live yet</h1>
        <p>The organizer application service is still being built.</p>
      </div>
    );
  return <ApplicationForm key={user.id} userId={user.id} />;
}
