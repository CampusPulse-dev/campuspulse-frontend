'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import styles from './Portal.module.css';
export { styles };
export function PageFrame({
  title,
  subtitle,
  hideHeader = false,
  children,
}: {
  title: string;
  subtitle: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      {!hideHeader ? (
        <header className={styles.header}>
          <h1>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
      ) : null}
      {children}
    </div>
  );
}
export function AccountGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <p role="status">Loading your account…</p>;
  if (!user)
    return (
      <section className={styles.panel}>
        <h2>Your campus, connected</h2>
        <p>Sign in to save plans and keep your tickets on this device.</p>
        <Link href="/sign-in">Sign in →</Link>
      </section>
    );
  return children;
}
export function ResourceState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => unknown;
}) {
  if (pending) return <p role="status">Loading…</p>;
  if (error)
    return (
      <div role="alert" className={styles.error}>
        <p>{error.message}</p>
        <Button variant="secondary" onClick={() => void retry()}>
          Retry
        </Button>
      </div>
    );
  return null;
}
