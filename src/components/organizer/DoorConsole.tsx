'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/mode';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import {
  loadDoor,
  prepareDemoPack,
  recordDemoCheckIn,
  resolveDemoDoor,
  syncDemoScans,
  verifyDemoToken,
  type DemoPack,
  type DemoScan,
} from '@/lib/door-demo';
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

function DoorDemo({
  owner,
  eventId,
  eventTitle,
}: {
  owner: string;
  eventId: string;
  eventTitle: string;
}) {
  const [pack, setPack] = useState<DemoPack | null>(null);
  const [scans, setScans] = useState<DemoScan[]>([]);
  const [tab, setTab] = useState('qr');
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: 'valid' | 'duplicate' | 'invalid';
    message: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [sampleQr, setSampleQr] = useState('');
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const data = await loadDoor(owner, eventId);
    setPack(data.pack);
    setScans(data.scans);
    setNow(Date.now());
  }, [owner, eventId]);
  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch(() => setError('Offline storage is unavailable.'));
  }, [refresh]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine)
        void syncDemoScans(owner, eventId)
          .then(refresh)
          .catch(() => setError('Demo queue could not be reconciled.'));
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const timer = window.setInterval(update, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [owner, eventId, refresh]);
  useEffect(() => {
    if (pack)
      void QRCode.toDataURL(pack.sampleToken)
        .then(setSampleQr)
        .catch(() => setSampleQr(''));
  }, [pack]);
  async function prepare() {
    if (!navigator.onLine) {
      setError('Connect to prepare the demo roster.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await prepareDoorRoute(`/organizer/door/${encodeURIComponent(eventId)}`);
      await prepareDemoPack(owner, eventId, eventTitle);
      await refresh();
    } catch (cause) {
      setError(
        `Could not prepare the demo roster (${cause instanceof Error ? cause.name : 'unknown error'}). Ed25519 and browser storage are required.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const accept = useCallback(
    async (attendeeId: string, method: DemoScan['method']) => {
      if (!pack || lock.current) return;
      lock.current = true;
      try {
        const scan = await recordDemoCheckIn(pack, attendeeId, method);
        const name = pack.roster.find((person) => person.id === attendeeId)?.name ?? 'Attendee';
        setResult({
          kind: scan.duplicate ? 'duplicate' : 'valid',
          message: `${scan.duplicate ? 'Already checked in' : 'Demo check-in recorded'} · ${name}`,
        });
        navigator.vibrate?.(scan.duplicate ? [100, 50, 100] : 100);
        await refresh();
        if (navigator.onLine) {
          await syncDemoScans(owner, eventId);
          await refresh();
        }
      } catch {
        setError('Could not save this check-in on the device.');
      } finally {
        lock.current = false;
      }
    },
    [pack, refresh, owner, eventId],
  );
  const scan = useCallback(
    async (code: string) => {
      if (!pack || lock.current) return;
      const attendee = await verifyDemoToken(code, pack);
      if (!attendee) {
        setResult({ kind: 'invalid', message: 'Invalid demo pass for this event' });
        navigator.vibrate?.([100, 50, 100]);
        return;
      }
      await accept(attendee, 'QR_SCAN');
    },
    [pack, accept],
  );
  const stale = pack && now - Date.parse(pack.syncedAt) > 6 * 60 * 60 * 1000;
  return (
    <div className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Door console · demo</p>
        <h1>{eventTitle}</h1>
        <p>
          Simulation only. Demo passes are never valid for entry; no check-ins are sent to a server.
        </p>
      </header>
      <section className={styles.readiness} aria-label="Door readiness">
        <strong>
          {!pack || stale ? 'Sync required before doors open' : 'Demo roster ready on this device'}
        </strong>
        <p>
          {pack
            ? `${pack.roster.length} demo attendees cached · ${pack.roster.filter((person) => person.checkedInAt).length} checked in`
            : 'No roster saved on this device.'}
        </p>
        <p>
          {online ? 'Online' : 'Offline'} · {scans.filter((item) => item.pending).length} pending
          demo check-ins
        </p>
        <Button onClick={() => void prepare()} disabled={busy || !online}>
          {pack ? 'Refresh roster now' : 'Sync demo roster'}
        </Button>
      </section>
      <Tabs
        tabs={[
          { id: 'qr', label: 'QR Scanner' },
          { id: 'manual', label: 'Manual Check-In' },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      {result ? (
        <div role="status" className={`${styles.result} ${styles[result.kind]}`}>
          <strong>
            {result.kind === 'valid'
              ? 'DEMO VALID'
              : result.kind === 'duplicate'
                ? 'DUPLICATE'
                : 'INVALID'}
          </strong>
          <p>{result.message}</p>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {!pack ? (
        <p>Sync the demo roster while online to use either check-in tab.</p>
      ) : tab === 'qr' ? (
        <section className={styles.panel} aria-label="QR scanner">
          <Camera onCode={(code) => void scan(code)} />
          <details>
            <summary>Try a demo pass</summary>
            <p>Sample pass for Demo Attendee 01. This is not a real ticket.</p>
            {sampleQr ? (
              // The locally generated data URL is not an optimizable remote image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sampleQr} alt="Sample demo QR code" />
            ) : null}
            <Button onClick={() => void scan(pack.sampleToken)}>Scan sample pass</Button>
          </details>
        </section>
      ) : (
        <section className={styles.panel} aria-label="Manual check-in">
          <label htmlFor="door-search">Find an attendee</label>
          <input
            id="door-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
          />
          <ul className={styles.list}>
            {pack.roster
              .filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((person) => (
                <li key={person.id}>
                  <span>
                    {person.name}
                    {person.checkedInAt ? ' · Checked in' : ''}
                  </span>
                  <Button onClick={() => void accept(person.id, 'MANUAL')}>
                    Check in {person.name}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      )}
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
  if (!DEMO_MODE)
    return (
      <div className={styles.page}>
        <h1>Door console not live yet</h1>
        <p>Real ticket verification and check-in require the attendance service.</p>
      </div>
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
    <DoorDemo
      key={`${user.id}:${eventId}`}
      owner={user.id}
      eventId={access.id}
      eventTitle={access.title}
    />
  );
}
