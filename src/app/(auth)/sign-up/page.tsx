'use client';
import { PasswordField, TextField } from '@/components/ui/Field';
import { emailProblem, normalizeEmail, useFieldErrors } from '@/lib/use-field-errors';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
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
  const fields = useFieldErrors(
    { displayName, email, password },
    {
      displayName: (value) => (value.trim() ? null : 'Enter the name friends know you by.'),
      email: (value) => emailProblem(value),
      password: (value) =>
        value.length >= 10
          ? null
          : value
            ? `Add ${10 - value.length} more character${10 - value.length === 1 ? '' : 's'}.`
            : 'Choose a password of at least 10 characters.',
    },
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!fields.validateAll(e.currentTarget)) return;
    setIsLoading(true);
    try {
      await signUp({ displayName: displayName.trim(), email: normalizeEmail(email), password });
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
      </div>

      <h1 className={styles.authTitle}>Join the Campus Feed</h1>
      <p className={styles.authSubtitle}>
        {refCode || inviteCode
          ? 'Your friend invited you to CampusPulse. Create your free account in 20 seconds.'
          : 'Sign up with any email. Verify your student status separately to access student-only events.'}
      </p>

      {error ? (
        <div role="alert" className={styles.errorBanner}>
          {error}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label={
            <>
              <span>Display Name</span>
            </>
          }
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Tobi Adeyemi"
          error={fields.errors.displayName}
          {...fields.blurProps('displayName')}
        />

        <TextField
          label={
            <>
              <span>Email Address</span>
            </>
          }
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@stu.ui.edu.ng"
          error={fields.errors.email}
          {...fields.blurProps('email')}
        />

        <PasswordField
          label={
            <>
              <span>Password</span>
            </>
          }
          hint="At least 10 characters."
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.errors.password}
          {...fields.blurProps('password')}
        />

        <Button type="submit" fullWidth size="lg" isLoading={isLoading} disabled={!ready}>
          Create account
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
