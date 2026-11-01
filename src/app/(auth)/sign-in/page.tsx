'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth-context';
import styles from '../Auth.module.css';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') ?? '/';
  const autoRsvp = searchParams.get('autoRsvp') === '1';

  const { signIn } = useAuth();
  const [email, setEmail] = useState('tobi.adeyemi@stu.ui.edu.ng');
  const [password, setPassword] = useState('CampusPulse2026!');
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
        <Badge variant="verified">UI · Ibadan</Badge>
      </div>

      <h1 className={styles.authTitle}>Welcome back</h1>
      <p className={styles.authSubtitle}>
        {autoRsvp
          ? 'Sign in to lock in your free RSVP and save your offline QR pass.'
          : 'Sign in to access your offline QR tickets and campus feed.'}
      </p>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.fieldLabel}>
          <span>Student or Personal Email</span>
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
          <span>Password</span>
          <input
            type="password"
            required
            className={styles.textInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
          {autoRsvp ? 'Sign In & Confirm RSVP →' : 'Sign In →'}
        </Button>
      </form>

      <p className={styles.switchRow}>
        New to CampusPulse?{' '}
        <Link href={`/sign-up?next=${encodeURIComponent(nextUrl)}`}>Create an account</Link>
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
