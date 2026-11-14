'use client';
import { TextField } from '@/components/ui/Field';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/mode';
import {
  attendeeRequest,
  readLocal,
  writeLocal,
  type VerificationState,
} from '@/lib/attendee-data';
import { uploadPrivateDocument } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AccountGate, PageFrame, ResourceState, styles } from './Shared';
export function Verification() {
  const { user, accessToken, markStudentVerified } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const key = `verification:${user?.id}`;
  const query = useQuery({
    queryKey: ['verification', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () =>
      DEMO_MODE
        ? readLocal<VerificationState>(key, {
            status: user?.isVerifiedStudent ? 'APPROVED' : 'NONE',
            note: null,
          })
        : attendeeRequest('StudentVerificationState', '/verification/student', accessToken),
  });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not complete verification. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  async function demoState(status: VerificationState['status']) {
    writeLocal(key, {
      status,
      note: status === 'REJECTED' ? 'Demo reviewer: upload a clearer image.' : null,
    });
    markStudentVerified(status === 'APPROVED');
    await query.refetch();
  }
  async function sendOtp() {
    // Same rule as the backend StudentEmail contract: any *.ui.edu.ng mailbox.
    if (!/^[^@\s]+@(?:[a-z0-9-]+\.)+ui\.edu\.ng$/i.test(email))
      throw new Error('Use your University of Ibadan email (e.g. you@stu.ui.edu.ng).');
    if (!DEMO_MODE)
      await attendeeRequest(
        'StudentOtpSentResponse',
        '/verification/student/email-otp',
        accessToken,
        'POST',
        { email },
      );
    setSent(true);
    setMessage(
      DEMO_MODE
        ? 'Demo code: 123456. No email was sent.'
        : 'A six-digit code has been sent. It expires in ten minutes.',
    );
  }
  async function confirmOtp() {
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code.');
    if (DEMO_MODE) {
      if (code !== '123456') throw new Error('Incorrect demo code. Try 123456.');
      await demoState('APPROVED');
    } else {
      const verified = await attendeeRequest(
        'UserPublic',
        '/verification/student/confirm-otp',
        accessToken,
        'POST',
        { email, code },
      );
      markStudentVerified(verified.isVerifiedStudent);
      await query.refetch();
    }
    setMessage('Student email verified.');
  }
  async function submitId() {
    const document = file.current?.files?.[0];
    if (
      !document ||
      !['image/jpeg', 'image/png'].includes(document.type) ||
      document.size > 5 * 1024 * 1024
    )
      throw new Error('Choose a JPEG or PNG image up to 5 MB.');
    try {
      if (DEMO_MODE) await demoState('PENDING');
      else {
        const handle = await attendeeRequest(
          'StudentUploadResponse',
          '/verification/student/upload-url',
          accessToken,
          'POST',
          { contentType: document.type, size: document.size },
        );
        await uploadPrivateDocument(handle.uploadUrl, document);
        await attendeeRequest(
          'StudentVerificationState',
          '/verification/student/id-request',
          accessToken,
          'POST',
          { documentUploadId: handle.uploadId },
        );
        await query.refetch();
      }
      setMessage('Submitted for private review.');
    } finally {
      if (file.current) file.current.value = '';
    }
  }
  return (
    <PageFrame
      title="Verify your student status"
      subtitle="Unlock student-only events. Choose student email or private ID review."
    >
      <AccountGate>
        <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />
        <section className={styles.panel}>
          <h2>Status: {query.data?.status ?? 'Not loaded'}</h2>
          {query.data?.note ? <p>{query.data.note}</p> : null}
          {message ? <p role="status">{message}</p> : null}
        </section>
        {query.data?.status !== 'APPROVED' ? (
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2>Use student email</h2>
              <form
                className={styles.list}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(sent ? confirmOtp : sendOtp);
                }}
              >
                <TextField
                  label={<>Student email</>}
                  required
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSent(false);
                    setCode('');
                  }}
                  autoComplete="email"
                />
                {sent ? (
                  <TextField
                    label={<>Six-digit code</>}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                ) : null}
                <Button type="submit" isLoading={busy}>
                  {sent ? 'Verify code' : 'Send code'}
                </Button>
                {sent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => run(sendOtp)}
                  >
                    Resend code
                  </Button>
                ) : null}
              </form>
            </section>
            <section className={styles.panel}>
              <h2>Private student ID review</h2>
              <p className={styles.muted}>
                Only a Super Admin can review your ID. Images are deleted after a decision. Your
                image is never saved to this device’s offline cache.
              </p>
              <form
                className={styles.list}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(submitId);
                }}
              >
                <TextField
                  label={<>Student ID image · JPEG or PNG · max 5 MB</>}
                  ref={file}
                  required
                  type="file"
                  accept="image/jpeg,image/png"
                />
                <Button type="submit" isLoading={busy} disabled={query.data?.status === 'PENDING'}>
                  {query.data?.status === 'PENDING' ? 'Awaiting review' : 'Submit for review'}
                </Button>
              </form>
            </section>
          </div>
        ) : null}
        {DEMO_MODE ? (
          <section className={styles.panel}>
            <h2>Demo review outcomes</h2>
            <p>No document is uploaded in demo mode.</p>
            <div className={styles.actions}>
              {(['APPROVED', 'REJECTED', 'INFO_REQUESTED'] as const).map((status) => (
                <Button
                  key={status}
                  variant="secondary"
                  onClick={() => run(() => demoState(status))}
                >
                  {status}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      </AccountGate>
    </PageFrame>
  );
}
