import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './ListRow.module.css';
export function ListRow({
  icon,
  leading,
  title,
  meta,
  trailing,
  href,
  children,
}: {
  icon?: LucideIcon;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const content = (
    <>
      {leading ??
        (icon ? (
          <span className={styles.icon}>
            <Icon icon={icon} />
          </span>
        ) : null)}
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
        {children}
      </div>
      {trailing ?? (href ? <Icon icon={ChevronRight} size={18} /> : null)}
    </>
  );
  return href ? (
    <Link href={href} className={styles.row}>
      {content}
    </Link>
  ) : (
    <div className={styles.row}>{content}</div>
  );
}
