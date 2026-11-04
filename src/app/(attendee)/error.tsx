'use client';
import { Button } from '@/components/ui/Button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Could not load this page</h1>
      <p>Please check your connection and try again.</p>
      <Button onClick={reset}>Retry</Button>
    </section>
  );
}
