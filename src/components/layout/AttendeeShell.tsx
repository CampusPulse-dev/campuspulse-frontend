'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/ui/BrandLockup';
import { usePathname } from 'next/navigation';
import { House, Ticket, Users, Bell, UserRound, Search, ArrowLeft } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { DemoBanner } from './DemoBanner';
import styles from './AttendeeShell.module.css';
export interface AttendeeShellProps {
  children: ReactNode;
  onOpenSearch?: () => void;
  unreadNotificationsCount?: number;
  userDisplayName?: string | null;
  isVerifiedStudent?: boolean;
  serverSignedIn?: boolean;
}
export function AttendeeShell({
  children,
  onOpenSearch,
  unreadNotificationsCount = 0,
  userDisplayName,
  isVerifiedStudent,
  serverSignedIn = false,
}: AttendeeShellProps) {
  const pathname = usePathname() ?? '/';
  if (pathname === '/' && !serverSignedIn)
    return (
      <div>
        <DemoBanner />
        <main className={styles.landingContent}>{children}</main>
      </div>
    );
  const home = userDisplayName ? '/' : '/explore';
  const items = [
    { href: home, label: 'Home', icon: House },
    { href: '/tickets', label: 'Tickets', icon: Ticket },
    { href: '/friends', label: 'Friends', icon: Users },
    { href: '/notifications', label: 'Alerts', icon: Bell },
    { href: '/settings', label: 'Profile', icon: UserRound },
  ];
  const detail = pathname.startsWith('/e/') || /^\/tickets\/.+/.test(pathname);
  const passPage = /^\/tickets\/.+/.test(pathname);
  const active = (href: string) =>
    href === home ? pathname === '/' || pathname === '/explore' : pathname.startsWith(href);
  const brand = <BrandLockup />;
  return (
    <div className={styles.shell} data-detail={detail || undefined}>
      <aside className={styles.sidebar} aria-label="Primary desktop navigation">
        <div className={styles.brandRow}>
          <Link href={home} className={styles.brandLink}>
            {brand}
          </Link>
        </div>
        <nav className={styles.sideNav}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[styles.sideNavLink, active(item.href) ? styles.sideNavActive : ''].join(
                ' ',
              )}
              aria-current={active(item.href) ? 'page' : undefined}
            >
              <Icon icon={item.icon} />
              <span className={styles.navText}>{item.label}</span>
              {item.href === '/notifications' && unreadNotificationsCount > 0 ? (
                <>
                  <span className={styles.unreadDot} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>, {unreadNotificationsCount} unread</span>
                </>
              ) : null}
            </Link>
          ))}
          <Link href="/search" className={styles.sideNavLink}>
            <Icon icon={Search} />
            Search
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          {userDisplayName ? (
            <div className={styles.userCard}>
              <span className={styles.userName}>
                {userDisplayName} {isVerifiedStudent ? <VerifiedMark /> : null}
              </span>
              <span className={styles.userRole}>
                {isVerifiedStudent ? 'UI student' : 'Student status unverified'}
              </span>
              {!isVerifiedStudent ? (
                <Link href="/verify" className={styles.verifyLink}>
                  Verify student status
                </Link>
              ) : null}
            </div>
          ) : (
            <div className={styles.authPrompt}>
              <p className={styles.authPromptCopy}>Find your people. Save your next plan.</p>
              <div className={styles.authLinks}>
                <Link href="/sign-in" className={styles.signInBtn}>
                  Sign in
                </Link>
                <Link href="/sign-up" className={styles.signUpBtn}>
                  Join CampusPulse
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className={styles.mainColumn}>
        <DemoBanner />
        <header className={styles.mobileHeader}>
          {passPage ? (
            <Link href="/tickets" className={styles.iconAction} aria-label="Back to tickets">
              <Icon icon={ArrowLeft} />
            </Link>
          ) : null}
          <Link href={home} className={styles.mobileBrand}>
            {brand}
          </Link>
          {passPage ? null : onOpenSearch ? (
            <button
              type="button"
              className={styles.iconAction}
              onClick={onOpenSearch}
              aria-label="Search events and clubs"
            >
              <Icon icon={Search} />
            </button>
          ) : (
            <Link href="/search" className={styles.iconAction} aria-label="Search events and clubs">
              <Icon icon={Search} />
            </Link>
          )}
        </header>
        <main className={styles.content}>{children}</main>
      </div>
      {!detail ? (
        <nav className={styles.bottomNav} aria-label="Mobile bottom navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                styles.bottomNavItem,
                active(item.href) ? styles.bottomNavActive : '',
              ].join(' ')}
              aria-current={active(item.href) ? 'page' : undefined}
            >
              <span className={styles.bottomNavIcon}>
                <Icon icon={item.icon} strokeWidth={active(item.href) ? 2.25 : 1.75} />
                {item.href === '/notifications' && unreadNotificationsCount > 0 ? (
                  <span className={styles.bottomUnreadDot} aria-hidden="true" />
                ) : null}
              </span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
              {item.href === '/notifications' && unreadNotificationsCount > 0 ? (
                <span className={styles.visuallyHidden}>, {unreadNotificationsCount} unread</span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
