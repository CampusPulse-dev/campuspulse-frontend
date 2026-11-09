import { useId, type ReactNode } from 'react';
import styles from './Section.module.css';
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      <div>{children}</div>
    </section>
  );
}
