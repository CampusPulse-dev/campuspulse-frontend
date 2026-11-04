'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';
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
}

export function Tabs({ tabs, activeId, onChange, layoutId = 'cp-tabs-indicator' }: TabsProps) {
  return (
    <div role="tablist" className={styles.tablist}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {isActive ? (
              <motion.span
                layoutId={layoutId}
                className={styles.indicator}
                transition={springSnappy}
              />
            ) : null}
            <span className={styles.tabLabel}>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <span className={styles.count}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
