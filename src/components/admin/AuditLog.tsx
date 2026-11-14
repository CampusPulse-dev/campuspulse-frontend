'use client';

import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ResourceState } from '@/components/attendee/Shared';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { fetchAuditLogs, type AuditEntry } from '@/lib/admin-data';
import { PageHeader } from './AdminBits';
import styles from './Admin.module.css';

const TARGET_TYPES = [
  { value: '', label: 'Everything' },
  { value: 'VerificationRequest', label: 'Verification' },
  { value: 'ModerationReport', label: 'Moderation' },
  { value: 'User', label: 'Users' },
  { value: 'PlatformSetting', label: 'Settings' },
];

const stamp = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function AuditLogView({
  entries,
  targetType,
  onTargetType,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  entries: AuditEntry[];
  targetType: string;
  onTargetType: (targetType: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Platform" title="Audit log">
        Every staff action, newest first. Entries cannot be edited or removed. Times are WAT.
      </PageHeader>
      <div className={styles.toolbar}>
        <SelectField
          label="Show"
          value={targetType}
          onChange={(event) => onTargetType(event.target.value)}
        >
          {TARGET_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>No entries match.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.auditTable}`}>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Actor</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const details = Object.keys(entry.metadata).length
                  ? JSON.stringify(entry.metadata)
                  : '';
                return (
                  <tr key={entry.id}>
                    <td>{stamp.format(new Date(entry.createdAt))}</td>
                    <td>{entry.action}</td>
                    <td>
                      {entry.targetType}
                      <br />
                      {entry.targetId}
                    </td>
                    <td>{entry.actorId}</td>
                    <td className={styles.metadata}>{details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasMore ? (
        <div className={styles.actions}>
          <Button variant="secondary" isLoading={loadingMore} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AuditLog() {
  const [targetType, setTargetType] = useState('');
  const log = useInfiniteQuery({
    queryKey: ['admin', 'audit', targetType],
    queryFn: ({ pageParam }) => fetchAuditLogs({ targetType: targetType || undefined }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (!log.data)
    return <ResourceState pending={log.isPending} error={log.error} retry={log.refetch} />;
  return (
    <AuditLogView
      entries={log.data.pages.flatMap((page) => page.items)}
      targetType={targetType}
      onTargetType={setTargetType}
      hasMore={log.hasNextPage}
      loadingMore={log.isFetchingNextPage}
      onLoadMore={() => void log.fetchNextPage()}
    />
  );
}
