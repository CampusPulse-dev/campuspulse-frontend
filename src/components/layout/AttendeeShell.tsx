'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';
import styles from './AttendeeShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  matchPrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: '⚡' },
  { href: '/tickets', label: 'Tickets', icon: '🎟️', matchPrefix: '/tickets' },
  { href: '/friends', label: 'Friends', icon: '👥', matchPrefix: '/friends' },
  { href: '/notifications', label: 'Alerts', icon: '🔔', matchPrefix: '/notifications' },
  { href: '/settings', label: 'Profile', icon: '👤', matchPrefix: '/settings' },
];

export interface AttendeeShellProps {
  children: React.ReactNode;
  onOpenSearch?: () => void;
  unreadNotificationsCount?: number;
  userDisplayName?: string | null;
  isVerifiedStudent?: boolean;
}

export function AttendeeShell({
  children,
  onOpenSearch,
  unreadNotificationsCount = 2,
  userDisplayName,
  isVerifiedStudent,
}: AttendeeShellProps) {
  const pathname = usePathname() ?? '/';

  function isRouteActive(item: NavItem) {
    if (item.href === '/') {
      return pathname === '/' || pathname.startsWith('/e/') || pathname.startsWith('/o/');
    }
    return item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href;
  }

  return (
    <div className={styles.shell}>
      {/* Desktop Left Rail Navigation (>= 1024px) */}
      <aside className={styles.sidebar} aria-label="Primary desktop navigation">
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brandLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" className={styles.brandLogo} />
            <span className={styles.brandWordmark}>CampusPulse</span>
          </Link>
          <span className={styles.campusBadge}>UI · Ibadan</span>
        </div>

        <nav className={styles.sideNav}>
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sideNavLink} ${active ? styles.sideNavActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="cp-desktop-nav-pill"
                    className={styles.sideNavIndicator}
                    transition={springSnappy}
                  />
                ) : null}
                <span className={styles.navIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.navText}>{item.label}</span>
                {item.href === '/notifications' && unreadNotificationsCount > 0 ? (
                  <span className={styles.unreadPill}>{unreadNotificationsCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          {userDisplayName ? (
            <div className={styles.userCard}>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{userDisplayName}</span>
                <span className={styles.userRole}>
                  {isVerifiedStudent ? '✓ Verified UI Student' : 'Unverified Student'}
                </span>
              </div>
              {!isVerifiedStudent ? (
                <Link href="/verify" className={styles.verifyLink}>
                  Verify @stu.ui.edu.ng →
                </Link>
              ) : null}
            </div>
          ) : (
            <div className={styles.authPrompt}>
              <p className={styles.authPromptCopy}>
                Lock in free RSVPs and save offline QR passes for the door.
              </p>
              <div className={styles.authLinks}>
                <Link href="/sign-in" className={styles.signInBtn}>
                  Sign In
                </Link>
                <Link href="/sign-up" className={styles.signUpBtn}>
                  Join UI Feed
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className={styles.mainColumn}>
        <header className={styles.mobileHeader}>
          <Link href="/" className={styles.mobileBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" className={styles.brandLogoSm} />
            <span className={styles.brandWordmarkSm}>CampusPulse</span>
          </Link>

          <div className={styles.headerActions}>
            {onOpenSearch ? (
              <button
                type="button"
                className={styles.iconAction}
                onClick={onOpenSearch}
                aria-label="Search events and clubs"
              >
                🔍
              </button>
            ) : null}
            <Link href="/notifications" className={styles.iconAction} aria-label="Notifications">
              🔔
              {unreadNotificationsCount > 0 ? <span className={styles.unreadDot} /> : null}
            </Link>
            {!userDisplayName ? (
              <Link href="/sign-in" className={styles.headerSignIn}>
                Sign In
              </Link>
            ) : null}
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>

      {/* Mobile Bottom Tab Bar (< 768px) */}
      <nav className={styles.bottomNav} aria-label="Mobile bottom navigation">
        {NAV_ITEMS.map((item) => {
          const active = isRouteActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.bottomNavItem} ${active ? styles.bottomNavActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {active ? (
                <motion.span
                  layoutId="cp-mobile-nav-pill"
                  className={styles.bottomNavIndicator}
                  transition={springSnappy}
                />
              ) : null}
              <span className={styles.bottomNavIcon} aria-hidden="true">
                {item.icon}
                {item.href === '/notifications' && unreadNotificationsCount > 0 ? (
                  <span className={styles.bottomUnreadDot} />
                ) : null}
              </span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
