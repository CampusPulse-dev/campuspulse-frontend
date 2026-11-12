'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiRequestError } from '@/lib/api';
import { DEMO_MODE } from '@/lib/mode';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { resolveDemoDoor } from '@/lib/door-demo';
import {
  demoDoorDriver,
  liveDoorDriver,
  type DoorDriver,
  type DoorPackView,
  type DoorScanView,
} from '@/lib/door-driver';
import { isTransientSyncError, type VerifyFailure } from '@/lib/door-live';
import { prepareDoorRoute } from '@/lib/door-cache';
import styles from './DoorConsole.module.css';

type Detection = { rawValue: string };
type Detector = { detect(source: HTMLVideoElement): Promise<Detection[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

function Camera({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastRead = 0;
    const canvas = document.createElement('canvas');
    const ctor = (globalThis as unknown as { BarcodeDetector?: DetectorConstructor })
      .BarcodeDetector;
    let detector: Detector | null = null;
    try {
      if (ctor) detector = new ctor({ formats: ['qr_code'] });
    } catch {
      detector = null;
    }
    async function scan() {
      const element = video.current;
      if (stopped || !element) return;
      if (element.readyState >= 2 && Date.now() - lastRead > 2000) {
        let code: string | undefined;
        try {
          if (detector) code = (await detector.detect(element))[0]?.rawValue;
        } catch {
          detector = null;
        }
        if (!detector && element.videoWidth && element.videoHeight) {
          canvas.width = element.videoWidth;
          canvas.height = element.videoHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (context) {
            context.drawImage(element, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            code = jsQR(pixels.data, pixels.width, pixels.height)?.data;
          }
        }
        if (code && !stopped) {
          lastRead = Date.now();
          onCodeRef.current(code);
        }
      }
      if (!stopped) frame = requestAnimationFrame(() => void scan());
    }
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        void scan();
      } catch {
        if (!stopped) {
          setError('Camera unavailable. Check permission or use Manual Check-In.');
          setActive(false);
        }
      }
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);
  return (
    <div className={styles.camera}>
      <video ref={video} playsInline muted aria-label="Camera preview" />
      {error ? <p role="alert">{error}</p> : null}
      <Button
        onClick={() => {
          setError('');
          setActive(!active);
        }}
      >
        {active ? 'Stop camera' : 'Start camera'}
      </Button>
    </div>
  );
}

type ResultKind = 'valid' | 'duplicate' | 'invalid';
type ScanResult = { id: number; kind: ResultKind; message: string };

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const SYNC_INTERVAL_MS = 15_000;
const MANUAL_LIST_LIMIT = 60;
/** Long enough to read, short enough not to slow the queue. A tap dismisses sooner. */
const RESULT_HOLD_MS: Record<ResultKind, number> = { valid: 900, duplicate: 2200, invalid: 2200 };
const HAPTICS: Record<ResultKind, number | number[]> = {
  valid: 80,
  duplicate: [60, 60, 60],
  invalid: [200, 80, 200],
};
const RESULT_ICON = { valid: CircleCheck, duplicate: TriangleAlert, invalid: CircleX } as const;

const LIVE_INVALID_COPY: Record<VerifyFailure, string> = {
  malformed: 'Not a CampusPulse ticket',
  signature: 'Not a CampusPulse ticket',
  'wrong-event': 'This ticket is for a different event',
  'not-on-roster': 'Not on this roster. Refresh the roster or use Manual Check-In.',
  superseded: 'This ticket was replaced. Ask for the current one.',
};

function resultLabel(kind: ResultKind, demo: boolean): string {
  if (kind === 'valid') return demo ? 'DEMO VALID' : 'VALID';
  return kind === 'duplicate' ? 'DUPLICATE' : 'INVALID';
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Door({
  driver,
  owner,
  eventId,
  eventTitle,
}: {
  driver: DoorDriver;
  owner: string;
  eventId: string;
  eventTitle: string | null;
}) {
  const demo = driver.demo;
  const decodedAt = useRef<number | null>(null);
  const [pack, setPack] = useState<DoorPackView | null>(null);
  const [scans, setScans] = useState<DoorScanView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('qr');
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState<ScanResult | null>(null);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sampleQr, setSampleQr] = useState('');
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const syncLock = useRef(false);
  const resultId = useRef(0);

  const refresh = useCallback(async () => {
    const data = await driver.load(owner, eventId);
    setPack(data.pack);
    setScans(data.scans);
    setNow(Date.now());
    setLoaded(true);
  }, [driver, owner, eventId]);

  /** Sends the outbox. Quiet when the network is simply down; that is the normal case at a door. */
  const sync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const report = await driver.flush(owner, eventId);
      const parts: string[] = [];
      if (report.rejected > 0) {
        parts.push(
          `${report.rejected} check-in${report.rejected === 1 ? ' was' : 's were'} refused by the server.`,
        );
      }
      if (report.duplicates > 0) {
        parts.push(`${report.duplicates} had already been checked in at another door.`);
      }
      if (parts.length > 0) setNotice(parts.join(' '));
      await refresh();
    } catch (cause) {
      if (!isTransientSyncError(cause)) {
        setError(
          cause instanceof ApiRequestError && cause.error.statusCode === 403
            ? 'Your door access for this event has ended. Queued check-ins are kept on this device.'
            : 'Sign in again to send queued check-ins. They are kept on this device.',
        );
      }
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [driver, owner, eventId, refresh]);

  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch(() => {
        setLoaded(true);
        setError('Offline storage is unavailable.');
      });
  }, [refresh]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      void sync();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const timer = window.setInterval(update, SYNC_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [sync]);

  useEffect(() => {
    if (pack?.sampleToken)
      void QRCode.toDataURL(pack.sampleToken)
        .then(setSampleQr)
        .catch(() => setSampleQr(''));
  }, [pack?.sampleToken]);

  // The full-bleed result clears itself so the next person can step up.
  useEffect(() => {
    if (!flash) return;
    if (decodedAt.current !== null) {
      // Duration only: no token, attendee identity or event data is recorded.
      performance.clearMeasures('cp-qr-feedback');
      performance.measure('cp-qr-feedback', { start: decodedAt.current, end: performance.now() });
      decodedAt.current = null;
    }
    const dismiss = () => setFlash((current) => (current?.id === flash.id ? null : current));
    const timer = window.setTimeout(dismiss, RESULT_HOLD_MS[flash.kind]);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [flash]);

  const show = useCallback((kind: ResultKind, message: string) => {
    resultId.current += 1;
    const next = { id: resultId.current, kind, message };
    setFlash(next);
    setLast(next);
    navigator.vibrate?.(HAPTICS[kind]);
  }, []);

  async function prepare() {
    if (!navigator.onLine) {
      setError(demo ? 'Connect to prepare the demo roster.' : 'Connect to download the roster.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Send what is queued first so the fresh roster already includes it.
      if (pack) await driver.flush(owner, eventId).catch(() => undefined);
      await driver.prepare(owner, eventId, eventTitle ?? '');
      await refresh();
      // Best effort: the roster is usable even if the offline page could not be saved.
      await prepareDoorRoute(`/organizer/door/${encodeURIComponent(eventId)}`).catch(() => {
        if (!demo)
          setNotice(
            'Roster saved. Keep this page open: it could not be stored for offline reloads.',
          );
        else throw new Error('offline shell');
      });
    } catch (cause) {
      const status = cause instanceof ApiRequestError ? cause.error.statusCode : 0;
      setError(
        demo
          ? `Could not prepare the demo roster (${cause instanceof Error ? cause.name : 'unknown error'}). Ed25519 and browser storage are required.`
          : status === 403
            ? 'You do not have door access for this event.'
            : status === 404
              ? 'This event could not be found.'
              : status === 401
                ? 'Sign in again to download the roster.'
                : 'Could not download the roster. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const accept = useCallback(
    async (attendeeId: string, method: DoorScanView['method'], token: string | null) => {
      if (!pack || lock.current) return;
      lock.current = true;
      try {
        const person = pack.roster.find((row) => row.id === attendeeId);
        const scan = await driver.record(pack, attendeeId, method, token);
        const name = person?.name ?? 'Attendee';
        if (scan.duplicate) {
          const when = person?.checkedInAt ? ` at ${clock(person.checkedInAt)}` : '';
          show('duplicate', `Already checked in${demo ? '' : when} · ${name}`);
        } else if (demo) {
          show('valid', `Demo check-in recorded · ${name}`);
        } else {
          const badge = person?.verified ? 'Verified student' : 'Guest';
          show('valid', `${name} · ${badge}`);
        }
        await refresh();
        void sync();
      } catch {
        setError('Could not save this check-in on the device.');
      } finally {
        lock.current = false;
      }
    },
    [pack, driver, demo, refresh, show, sync],
  );

  const scan = useCallback(
    async (code: string) => {
      if (!pack || lock.current) return;
      decodedAt.current = performance.now();
      const verdict = await driver.verify(code, pack);
      if (!verdict.ok) {
        show(
          'invalid',
          demo ? 'Invalid demo pass for this event' : LIVE_INVALID_COPY[verdict.reason],
        );
        return;
      }
      await accept(verdict.attendeeId, 'QR_SCAN', code.trim());
    },
    [pack, driver, demo, accept, show],
  );

  const pending = scans.filter((item) => item.pending).length;
  const refused = scans.filter((item) => item.rejected).length;
  const checkedIn = pack ? pack.roster.filter((person) => person.checkedInAt).length : 0;
  const stale = pack !== null && now - Date.parse(pack.syncedAt) > STALE_AFTER_MS;
  const term = query.trim().toLowerCase();
  const matches = pack
    ? pack.roster.filter((person) => person.name.toLowerCase().includes(term))
    : [];
  const title = pack?.eventTitle || eventTitle || 'Door console';

  const pill = !online
    ? pending > 0
      ? `Offline · ${pending} queued`
      : 'Offline'
    : syncing && pending > 0
      ? `Sending ${pending}…`
      : pending > 0
        ? `${pending} queued`
        : demo
          ? 'Online'
          : 'Synced';
  const pillTone = !online
    ? styles.pillOffline
    : pending > 0
      ? styles.pillQueued
      : styles.pillSynced;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <p className={styles.eyebrow}>{demo ? 'Door console · demo' : 'Door console'}</p>
          <p className={`${styles.pill} ${pillTone}`} aria-live="polite">
            <span className={styles.pillDot} aria-hidden="true" />
            {pill}
          </p>
        </div>
        <h1>{title}</h1>
        {demo ? (
          <p>
            Simulation only. Demo passes are never valid for entry; no check-ins are sent to a
            server.
          </p>
        ) : null}
      </header>

      <section className={styles.readiness} aria-label="Door readiness">
        <strong>
          {!pack || stale
            ? 'Sync required before doors open'
            : demo
              ? 'Demo roster ready on this device'
              : 'Roster ready on this device'}
        </strong>
        <p>
          {pack
            ? demo
              ? `${pack.roster.length} demo attendees cached · ${checkedIn} checked in`
              : `${pack.roster.length} on the roster · ${checkedIn} checked in · updated ${clock(pack.syncedAt)}`
            : loaded
              ? 'No roster saved on this device.'
              : 'Loading saved roster…'}
        </p>
        {demo ? (
          <p>
            {online ? 'Online' : 'Offline'} · {pending} pending demo check-ins
          </p>
        ) : refused > 0 ? (
          <p className={styles.warn}>
            {refused} check-in{refused === 1 ? '' : 's'} refused by the server. Refresh the roster
            to see who is affected.
          </p>
        ) : null}
        <Button onClick={() => void prepare()} disabled={busy || !online} isLoading={busy}>
          {pack ? 'Refresh roster now' : demo ? 'Sync demo roster' : 'Download roster'}
        </Button>
      </section>

      {notice ? (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <Tabs
        label="Check-in method"
        tabs={[
          { id: 'qr', label: 'QR Scanner' },
          { id: 'manual', label: 'Manual Check-In' },
        ]}
        activeId={tab}
        onChange={setTab}
      >
        {last && !flash ? (
          <div className={`${styles.lastResult} ${styles[last.kind]}`}>
            <Icon icon={RESULT_ICON[last.kind]} size={22} />
            <strong>{resultLabel(last.kind, demo)}</strong>
            <span>{last.message}</span>
          </div>
        ) : null}
        {!pack ? (
          <p className={styles.muted}>
            {demo
              ? 'Sync the demo roster while online to use either check-in tab.'
              : 'Download the roster while online to use either check-in tab.'}
          </p>
        ) : tab === 'qr' ? (
          <section className={styles.panel} aria-label="QR scanner">
            <Camera onCode={(code) => void scan(code)} />
            {pack.sampleToken ? (
              <details>
                <summary>Try a demo pass</summary>
                <p>Sample pass for Demo Attendee 01. This is not a real ticket.</p>
                {sampleQr ? (
                  // The locally generated data URL is not an optimizable remote image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sampleQr} alt="Sample demo QR code" />
                ) : null}
                <Button onClick={() => void scan(pack.sampleToken ?? '')}>Scan sample pass</Button>
              </details>
            ) : null}
          </section>
        ) : (
          <section className={styles.panel} aria-label="Manual check-in">
            <label htmlFor="door-search">Find an attendee</label>
            <input
              id="door-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
            />
            {matches.length === 0 ? (
              <p className={styles.muted}>
                No one on this roster matches. Check the spelling, or refresh the roster.
              </p>
            ) : null}
            <ul className={styles.list}>
              {matches.slice(0, MANUAL_LIST_LIMIT).map((person) => (
                <li key={person.id}>
                  <span className={styles.person}>
                    <span className={styles.personName}>
                      {person.name}
                      {demo && person.checkedInAt ? ' · Checked in' : ''}
                    </span>
                    {!demo ? (
                      <span className={styles.personMeta}>
                        {person.verified ? 'Verified student' : 'Guest'}
                        {person.checkedInAt ? ` · Checked in ${clock(person.checkedInAt)}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    className={styles.checkInButton}
                    variant={person.checkedInAt ? 'secondary' : 'primary'}
                    disabled={!demo && Boolean(person.checkedInAt)}
                    aria-label={`Check in ${person.name}`}
                    onClick={() => void accept(person.id, 'MANUAL', null)}
                  >
                    {!demo && person.checkedInAt ? 'Done' : 'Check in'}
                  </Button>
                </li>
              ))}
            </ul>
            {matches.length > MANUAL_LIST_LIMIT ? (
              <p className={styles.muted}>
                Showing {MANUAL_LIST_LIMIT} of {matches.length}. Keep typing to narrow it down.
              </p>
            ) : null}
          </section>
        )}
      </Tabs>

      {flash ? (
        <div
          key={flash.id}
          role="status"
          className={`${styles.flash} ${styles[`flash_${flash.kind}`]}`}
          onClick={() => setFlash(null)}
        >
          <Icon icon={RESULT_ICON[flash.kind]} size={96} strokeWidth={1.5} />
          <strong>{resultLabel(flash.kind, demo)}</strong>
          <p>{flash.message}</p>
          <span className={styles.flashHint}>Tap to continue</span>
        </div>
      ) : null}
    </div>
  );
}

export function DoorConsole({ eventId }: { eventId: string }) {
  const { user, ready } = useAuth();
  const [access, setAccess] = useState<{ id: string; title: string; userId: string } | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    if (!ready || !user || !DEMO_MODE) return;
    void resolveDemoDoor(user, eventId)
      .then((found) => {
        if (active) {
          setAccess(
            found ? { id: found.event.id, title: found.event.title, userId: user.id } : null,
          );
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [eventId, user, ready]);
  if (!ready)
    return (
      <div className={styles.page}>
        <p>Checking access…</p>
      </div>
    );
  if (!user)
    return (
      <div className={styles.page}>
        <h1>Sign in to use the door console</h1>
        <Link href={`/sign-in?next=${encodeURIComponent(`/organizer/door/${eventId}`)}`}>
          Sign in
        </Link>
      </div>
    );
  // Live: the server decides access when the roster is downloaded (team or door-staff grant).
  if (!DEMO_MODE)
    return (
      <Door
        key={`${user.id}:${eventId}`}
        driver={liveDoorDriver}
        owner={user.id}
        eventId={eventId}
        eventTitle={null}
      />
    );
  if (!checked || (access && (access.userId !== user.id || access.id !== eventId)))
    return (
      <div className={styles.page}>
        <p>Checking access…</p>
      </div>
    );
  if (!access)
    return (
      <div className={styles.page}>
        <h1>Door access unavailable</h1>
        <p>You do not have access to this event, or the event is unavailable.</p>
      </div>
    );
  return (
    <Door
      key={`${user.id}:${eventId}`}
      driver={demoDoorDriver}
      owner={user.id}
      eventId={access.id}
      eventTitle={access.title}
    />
  );
}
