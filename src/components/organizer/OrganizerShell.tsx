'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { DEMO_MODE } from '@/lib/mode';
import { springSnappy } from '@/lib/motion';
import { useOrganizerAccess } from '@/lib/organizer-data';
import styles from '../layout/AttendeeShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export function navItems(slug: string | null, isOwner: boolean): NavItem[] {
  if (!slug) return [{ href: '/organizer', label: 'My clubs', icon: '🏛️', exact: true }];
  return [
    { href: `/organizer/${slug}`, label: 'Dashboard', icon: '📊', exact: true },
    { href: `/organizer/${slug}/events/new`, label: 'New event', icon: '➕' },
    { href: `/organizer/${slug}/stories/new`, label: 'New story', icon: '📸' },
    // Team management is owner-only; managers never see the link.
    ...(isOwner ? [{ href: `/organizer/${slug}/team`, label: 'Team', icon: '👥' }] : []),
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
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Organizer desktop navigation">
        <div className={styles.brandRow}>
          <Link href="/organizer" className={styles.brandLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" className={styles.brandLogo} />
            <span className={styles.brandWordmark}>CampusPulse</span>
          </Link>
          <span className={styles.campusBadge}>Organizer</span>
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
                {active ? (
                  <motion.span
                    layoutId="cp-org-desktop-nav-pill"
                    className={styles.sideNavIndicator}
                    transition={springSnappy}
                  />
                ) : null}
                <span className={styles.navIcon} aria-hidden="true">
                  {item.icon}
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
            <Link href="/" className={styles.verifyLink}>
              ← Back to campus feed
            </Link>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        {DEMO_MODE ? (
          <div
            role="status"
            style={{
              padding: 'var(--space-3)',
              background: 'var(--status-warning-bg)',
              textAlign: 'center',
            }}
          >
            Demo mode · Sample club data · Nothing here is published to students
          </div>
        ) : null}
        <header className={styles.mobileHeader}>
          <Link href="/organizer" className={styles.mobileBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" className={styles.brandLogoSm} />
            <span className={styles.brandWordmarkSm}>CampusPulse Organizer</span>
          </Link>
        </header>

        <main className={styles.content}>{children}</main>
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
              {active ? (
                <motion.span
                  layoutId="cp-org-mobile-nav-pill"
                  className={styles.bottomNavIndicator}
                  transition={springSnappy}
                />
              ) : null}
              <span className={styles.bottomNavIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
