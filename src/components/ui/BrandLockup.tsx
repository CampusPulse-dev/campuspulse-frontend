import Image from 'next/image';
import styles from './BrandLockup.module.css';

export function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <Image
      src="/brand/logo-wordmark.svg"
      alt="CampusPulse"
      width={180}
      height={33}
      className={`${styles.lockup} ${inverse ? styles.inverse : ''}`}
      priority
    />
  );
}
