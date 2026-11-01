'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, type PersonaProfile } from '@/lib/auth-context';
import { safeNext } from '@/lib/mode';
import { OnboardingWizard } from './OnboardingWizard';
import styles from '../Auth.module.css';
function OnboardingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { savePersona } = useAuth();
  const [error, setError] = useState('');
  async function handleComplete(profile: PersonaProfile) {
    try {
      await savePersona(profile);
      router.push(safeNext(params.get('next')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your persona. Please retry.');
    }
  }
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <OnboardingWizard onComplete={handleComplete} />
    </>
  );
}
export default function OnboardingPage() {
  return (
    <main className={styles.authPage}>
      <Suspense fallback={<p>Loading…</p>}>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}
