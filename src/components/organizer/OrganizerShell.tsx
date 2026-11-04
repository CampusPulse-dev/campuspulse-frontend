'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/ui/BrandLockup';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChartNoAxesCombined,
  CalendarDays,
  Camera,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { useOrganizerAccess } from '@/lib/organizer-data';
import styles from '../layout/AttendeeShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function navItems(slug: string | null, isOwner: boolean): NavItem[] {
  if (!slug) return [{ href: '/organizer', label: 'My clubs', icon: Building2, exact: true }];
  return [
    { href: `/organizer/${slug}`, label: 'Dashboard', icon: ChartNoAxesCombined, exact: true },
    { href: `/organizer/${slug}/events`, label: 'Events', icon: CalendarDays },
    { href: `/organizer/${slug}/stories/new`, label: 'New story', icon: Camera },
    // Team management is owner-only; managers never see the link.
    ...(isOwner ? [{ href: `/organizer/${slug}/team`, label: 'Team', icon: Users }] : []),
  ];
}

export interface OrganizerShellProps {
  children: React.ReactNode;
  slug: string | null;
  userDisplayName?: string | null;
}

export function OrganizerShell({ children, slug, userDisplayName }: OrganizerShellProps) {
  const pathname = usePathname() ?? '/';
  const access = useOrganizerAccess(slug ?? '');
  const items = navItems(slug, access.status === 'granted' && access.role === 'OWNER');

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <div className={`${styles.shell} ${styles.organizerShell}`}>
      <aside className={styles.sidebar} aria-label="Organizer desktop navigation">
        <div className={styles.brandRow}>
          <Link href="/organizer" className={styles.brandLink}>
            <BrandLockup />
          </Link>
        </div>

        <nav className={styles.sideNav}>
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sideNavLink} ${active ? styles.sideNavActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  <Icon icon={item.icon} />
                </span>
                <span className={styles.navText}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{userDisplayName ?? 'Organizer'}</span>
              <span className={styles.userRole}>Club organizer</span>
            </div>
            <Link href="/explore" className={styles.verifyLink}>
              ← Back to campus feed
            </Link>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <DemoBanner />
        <header className={styles.mobileHeader}>
          <Link href="/organizer" className={styles.mobileBrand}>
            <BrandLockup />
          </Link>
        </header>

        <main className={`${styles.content} ${styles.organizerContent}`}>{children}</main>
      </div>

      <nav className={styles.bottomNav} aria-label="Organizer mobile navigation">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.bottomNavItem} ${active ? styles.bottomNavActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.bottomNavIcon} aria-hidden="true">
                <Icon icon={item.icon} />
              </span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
