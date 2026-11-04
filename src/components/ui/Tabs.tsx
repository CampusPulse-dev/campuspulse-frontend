'use client';
import { useId, useRef, type ReactNode } from 'react';
import styles from './Tabs.module.css';
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}
export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  layoutId?: string;
  children?: ReactNode;
  label?: string;
}
export function Tabs({ tabs, activeId, onChange, children, label = 'Views' }: TabsProps) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.tablist}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={id + '-' + tab.id}
            role="tab"
            type="button"
            aria-selected={activeId === tab.id}
            aria-controls={id + '-panel'}
            tabIndex={activeId === tab.id ? 0 : -1}
            className={[styles.tab, activeId === tab.id ? styles.active : ''].join(' ')}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              const target = tabs[next];
              if (target) {
                onChange(target.id);
                refs.current[next]?.focus();
              }
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <span className={styles.count}>{tab.count}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div
        id={id + '-panel'}
        role="tabpanel"
        aria-labelledby={id + '-' + activeId}
        tabIndex={0}
        className={styles.panel}
      >
        {children}
      </div>
    </div>
  );
}
