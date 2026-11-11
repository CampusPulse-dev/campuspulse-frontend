'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  Flag,
  IdCard,
  LayoutDashboard,
  ScrollText,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { BrandLockup } from '@/components/ui/BrandLockup';
import { Icon } from '@/components/ui/Icon';
import { DemoBanner } from '@/components/layout/DemoBanner';
import {
  ADMIN_NAV,
  ROLE_LABELS,
  canAccess,
  isStaff,
  sectionForPath,
  type AdminSection,
} from '@/lib/admin-access';
import { fetchOverview, formatWaiting, hoursSince, type AdminOverview } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import { useNow } from './AdminBits';
import styles from './Admin.module.css';

const ICONS: Record<AdminSection, LucideIcon> = {
  overview: LayoutDashboard,
  organizers: Building2,
  students: IdCard,
  moderation: Flag,
  users: Users,
  settings: SlidersHorizontal,
  audit: ScrollText,
  docs: BookOpen,
};

export const OVERVIEW_KEY = ['admin', 'overview'] as const;

export function useOverview() {
  return useQuery({ queryKey: OVERVIEW_KEY, queryFn: fetchOverview, refetchInterval: 60_000 });
}

function countFor(section: AdminSection, overview: AdminOverview | undefined): number | null {
  if (!overview) return null;
  const pending = overview.pendingVerifications;
  if (section === 'organizers') return pending.organizerClub + pending.creatorProfile;
  if (section === 'students') return pending.studentId;
  if (section === 'moderation') return overview.openReports;
  return null;
}

/** Oldest open request against the SLA. Neutral until it is breached; never colour alone. */
export function SlaHeader({ overview, now }: { overview: AdminOverview | undefined; now: number }) {
  if (!overview) {
    return (
      <div className={styles.sla} role="status">
        Loading queue status…
      </div>
    );
  }
  const oldest = overview.oldestPendingSubmittedAt;
  const breached = oldest !== null && hoursSince(oldest, now) >= overview.slaHours;
  return (
    <div className={styles.sla} role="status" aria-label="Review SLA">
      <span className={`${styles.slaItem} ${breached ? styles.slaBreach : ''}`}>
        {breached ? <Icon icon={TriangleAlert} size={16} /> : null}
        {oldest === null ? (
          'Nothing waiting for review'
        ) : (
          <>
            Oldest waiting <strong>{formatWaiting(oldest, now)}</strong>
            {breached ? `Past the ${overview.slaHours}h SLA` : `SLA ${overview.slaHours}h`}
          </>
        )}
      </span>
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className={styles.gate}>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname() ?? '/admin';

  if (!ready)
    return (
      <Gate title="CampusPulse Admin">
        <p role="status">Checking your access…</p>
      </Gate>
    );
  if (!user)
    return (
      <Gate title="Sign in to continue">
        <p>The admin portal is for CampusPulse staff.</p>
        <Link className={styles.link} href={'/sign-in?next=' + encodeURIComponent('/admin')}>
          Sign in →
        </Link>
      </Gate>
    );
  if (!isStaff(user.role))
    return (
      <Gate title="Staff only">
        <p role="alert">Your account does not have access to the admin portal.</p>
        <Link className={styles.link} href="/">
          Back to the campus feed
        </Link>
      </Gate>
    );

  const section = sectionForPath(pathname);
  const allowed = section !== null && canAccess(user.role, section);
  return (
    <StaffShell role={user.role} name={user.displayName} active={section}>
      {allowed ? (
        children
      ) : (
        <div className={styles.page}>
          <p role="alert" className={styles.error}>
            Your role ({ROLE_LABELS[user.role]}) does not have access to this page.
          </p>
          <Link className={styles.link} href="/admin">
            Back to the overview
          </Link>
        </div>
      )}
    </StaffShell>
  );
}

function StaffShell({
  role,
  name,
  active,
  children,
}: {
  role: Parameters<typeof canAccess>[0];
  name: string;
  active: AdminSection | null;
  children: React.ReactNode;
}) {
  const overview = useOverview().data;
  const now = useNow(30_000);
  // Links a role cannot use are not rendered at all, so the student ID queue is invisible to them.
  const items = ADMIN_NAV.filter((item) => canAccess(role, item.section));

  const links = (withCounts: boolean) =>
    items.map((item) => {
      const current = item.section === active;
      const count = withCounts ? countFor(item.section, overview) : null;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navLink} ${current ? styles.navActive : ''}`}
          aria-current={current ? 'page' : undefined}
        >
          <Icon icon={ICONS[item.section]} size={18} />
          <span>{item.label}</span>
          {count !== null && count > 0 ? (
            <span className={styles.navCount} aria-label={`${count} waiting`}>
              {count}
            </span>
          ) : null}
        </Link>
      );
    });

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="Admin navigation">
        <Link href="/admin" className={styles.brand}>
          <BrandLockup />
          <span className={styles.brandTag}>Admin</span>
        </Link>
        <nav className={styles.railNav}>{links(true)}</nav>
        <div className={styles.railFooter}>
          <span className={styles.railName}>{name}</span>
          <span className={styles.railRole}>{role ? ROLE_LABELS[role] : ''}</span>
          <Link href="/">← Back to campus feed</Link>
        </div>
      </aside>

      <div className={styles.main}>
        <DemoBanner />
        <header className={styles.topbar}>
          <Link href="/admin" className={styles.brand}>
            <BrandLockup />
            <span className={styles.brandTag}>Admin</span>
          </Link>
          <span className={styles.railRole}>{role ? ROLE_LABELS[role] : ''}</span>
        </header>
        <nav className={styles.mobileNav} aria-label="Admin sections">
          {links(false)}
        </nav>
        <SlaHeader overview={overview} now={now} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
