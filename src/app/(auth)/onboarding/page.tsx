'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type PersonaProfile } from '@/lib/auth-context';
import { OnboardingWizard } from './OnboardingWizard';
import styles from '../Auth.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const { savePersona } = useAuth();

  function handleComplete(profile: PersonaProfile) {
    savePersona(profile);
    router.push('/');
  }

  return (
    <main className={styles.authPage}>
      <OnboardingWizard onComplete={handleComplete} />
    </main>
  );
}
