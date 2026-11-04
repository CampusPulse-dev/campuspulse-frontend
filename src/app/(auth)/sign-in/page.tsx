'use client';
import { TextField } from '@/components/ui/Field';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { safeNext } from '@/lib/mode';
import { useAuth } from '@/lib/auth-context';
import styles from '../Auth.module.css';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = safeNext(searchParams.get('next'));
  const autoRsvp = searchParams.get('autoRsvp') === '1';

  const { signIn, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await signIn({ email, password });
      const target = autoRsvp
        ? `${nextUrl}${nextUrl.includes('?') ? '&' : '?'}autoRsvp=1`
        : nextUrl;
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
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

      <h1 className={styles.authTitle}>Welcome back</h1>
      <p className={styles.authSubtitle}>
        {autoRsvp
          ? 'Sign in to lock in your free RSVP and save your offline QR pass.'
          : 'Sign in to access your offline QR tickets and campus feed.'}
      </p>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={
            <>
              <span>Student or Personal Email</span>
            </>
          }
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@stu.ui.edu.ng"
        />

        <TextField
          label={
            <>
              <span>Password</span>
            </>
          }
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" fullWidth size="lg" isLoading={isLoading} disabled={!ready}>
          Sign in
        </Button>
      </form>

      <p className={styles.switchRow}>
        New to CampusPulse?{' '}
        <Link href={`/sign-up?${searchParams.toString()}`}>Create an account</Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className={styles.authPage}>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
