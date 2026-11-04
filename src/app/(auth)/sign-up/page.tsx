'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth-context';
import styles from '../Auth.module.css';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');
  const inviteCode = searchParams.get('invite');

  const { signUp, ready } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim() || !email.trim() || password.length < 10) {
      setError('Please enter your name, email, and a password of at least 10 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await signUp({ displayName, email, password });
      router.push('/onboarding?' + searchParams.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <div className={styles.brandHeader}>
        <Link href="/" className={styles.brandLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="" className={styles.brandIcon} />
          <span>CampusPulse</span>
        </Link>
        <Badge variant="verified">UI · Ibadan</Badge>
      </div>

      <h1 className={styles.authTitle}>Join the Campus Feed</h1>
      <p className={styles.authSubtitle}>
        {refCode || inviteCode
          ? 'Your friend invited you to CampusPulse. Create your free account in 20 seconds.'
          : 'Sign up with any email. Verify your student status separately to access student-only events.'}
      </p>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.fieldLabel}>
          <span>Display Name</span>
          <input
            type="text"
            required
            className={styles.textInput}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Tobi Adeyemi"
          />
        </label>

        <label className={styles.fieldLabel}>
          <span>Email Address</span>
          <input
            type="email"
            required
            className={styles.textInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@stu.ui.edu.ng"
          />
        </label>

        <label className={styles.fieldLabel}>
          <span>Password (min. 10 characters)</span>
          <input
            type="password"
            required
            minLength={10}
            className={styles.textInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <Button type="submit" fullWidth size="lg" isLoading={isLoading} disabled={!ready}>
          Continue to 30s Persona Setup →
        </Button>
      </form>

      <p className={styles.switchRow}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <main className={styles.authPage}>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
