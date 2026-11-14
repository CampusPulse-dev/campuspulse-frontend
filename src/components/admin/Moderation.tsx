'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResourceState } from '@/components/attendee/Shared';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  fetchReports,
  formatWaiting,
  resolveReport,
  type AdminReport,
  type ReportAction,
  type ReportStatus,
  type ResolveBody,
} from '@/lib/admin-data';
import { formatWatDateTime } from '@/lib/campus-data';
import { ConfirmDialog, PageHeader, useNow, type ConfirmRequest } from './AdminBits';
import { OVERVIEW_KEY } from './AdminShell';
import styles from './Admin.module.css';

const STATUS_TABS: { id: ReportStatus; label: string }[] = [
  { id: 'OPEN', label: 'Open' },
  { id: 'RESOLVED', label: 'Actioned' },
  { id: 'DISMISSED', label: 'Dismissed' },
];

interface ActionCopy {
  action: ReportAction;
  label: string;
  title: (report: AdminReport) => string;
  subtitle: string;
  danger: boolean;
}

/** Only the actions that make sense for what was reported. Dismiss is always available. */
export function actionsFor(report: AdminReport): ActionCopy[] {
  const label = report.targetLabel ?? 'this item';
  const actions: ActionCopy[] = [];
  const type = report.targetType.toUpperCase();
  if (type === 'EVENT')
    actions.push({
      action: 'UNPUBLISH_EVENT',
      label: 'Unpublish event',
      title: () => `Unpublish ${label}?`,
      subtitle: 'The event is cancelled and everyone who RSVPed is told. This cannot be undone.',
      danger: true,
    });
  if (type === 'STORY')
    actions.push({
      action: 'REMOVE_STORY',
      label: 'Remove story',
      title: () => 'Remove this story?',
      subtitle: 'The story is deleted for everyone. This cannot be undone.',
      danger: true,
    });
  if (type === 'USER')
    actions.push({
      action: 'SUSPEND_USER',
      label: 'Suspend user',
      title: () => `Suspend ${label}?`,
      subtitle: 'They are signed out and cannot sign back in until a Super Admin reinstates them.',
      danger: true,
    });
  actions.push({
    action: 'DISMISS',
    label: 'Dismiss',
    title: () => 'Dismiss this report?',
    subtitle: 'No action is taken against the reported content.',
    danger: false,
  });
  return actions;
}

export function ModerationView({
  reports,
  status,
  onStatusChange,
  onResolve,
}: {
  reports: AdminReport[];
  status: ReportStatus;
  onStatusChange: (status: ReportStatus) => void;
  onResolve: (id: string, body: ResolveBody) => Promise<void>;
}) {
  const now = useNow(30_000);
  const { pushToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;

  function open(report: AdminReport, copy: ActionCopy) {
    setConfirm({
      title: copy.title(report),
      subtitle: copy.subtitle,
      confirmLabel: copy.label,
      danger: copy.danger,
      note: 'required',
      noteLabel: 'Resolution note (kept in the audit log)',
      run: async (note) => {
        await onResolve(report.id, {
          action: copy.action,
          note: note ?? '',
          ...(copy.action === 'SUSPEND_USER' ? { userId: report.targetId } : {}),
        });
        setSelectedId(null);
        pushToast(copy.action === 'DISMISS' ? 'Report dismissed.' : 'Report actioned.', 'info');
      },
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Moderation" title="Reports">
        Reports from students, oldest first. Every decision needs a note and is written to the audit
        log.
      </PageHeader>
      <Tabs
        label="Report status"
        tabs={STATUS_TABS}
        activeId={status}
        onChange={(id) => {
          setSelectedId(null);
          onStatusChange(id as ReportStatus);
        }}
      >
        {reports.length === 0 ? (
          <p className={styles.empty}>
            {status === 'OPEN' ? 'No open reports.' : 'Nothing here yet.'}
          </p>
        ) : (
          <div className={styles.split}>
            <ul className={styles.list} aria-label="Reports">
              {reports.map((report) => {
                const current = report.id === selected?.id;
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      className={`${styles.row} ${current ? styles.rowActive : ''}`}
                      aria-current={current ? 'true' : undefined}
                      onClick={() => setSelectedId(report.id)}
                    >
                      <span className={styles.rowTitle}>
                        {report.targetLabel ?? 'Removed content'}
                      </span>
                      <span className={styles.rowMeta}>
                        <span>{report.targetType.toLowerCase()}</span>
                        <span>{report.reasonCategory.toLowerCase().replace(/_/g, ' ')}</span>
                        <span>{formatWaiting(report.createdAt, now)} ago</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected ? (
              <div className={styles.detailTray}>
                <section
                  key={selected.id}
                  className={styles.detailCore}
                  aria-label="Report details"
                >
                  <header className={styles.detailHeader}>
                    <div className={styles.eyebrow}>
                      {selected.reasonCategory.replace(/_/g, ' ')}
                    </div>
                    <h2>{selected.targetLabel ?? 'Removed content'}</h2>
                  </header>
                  <p className={styles.quote}>{selected.details}</p>
                  <dl className={styles.facts}>
                    <dt>Reported</dt>
                    <dd className={styles.mono}>
                      {formatWatDateTime(selected.createdAt).compactLabel} WAT
                    </dd>
                    <dt>Reported by</dt>
                    <dd>{selected.reporter.displayName}</dd>
                    <dt>Target</dt>
                    <dd className={styles.mono}>
                      {selected.targetType} · {selected.targetId}
                    </dd>
                    {selected.resolutionNote ? (
                      <>
                        <dt>Resolution</dt>
                        <dd>{selected.resolutionNote}</dd>
                      </>
                    ) : null}
                  </dl>
                  {selected.targetLabel === null ? (
                    <p className={styles.notice}>
                      The reported content no longer exists. You can still dismiss the report.
                    </p>
                  ) : null}
                  {selected.status === 'OPEN' ? (
                    <div className={styles.actions}>
                      {actionsFor(selected).map((copy) => (
                        <Button
                          key={copy.action}
                          variant={copy.danger ? 'danger' : 'secondary'}
                          onClick={() => open(selected, copy)}
                        >
                          {copy.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        )}
      </Tabs>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export function Moderation() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const reports = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => fetchReports(status),
  });
  if (!reports.data)
    return (
      <ResourceState pending={reports.isPending} error={reports.error} retry={reports.refetch} />
    );
  return (
    <ModerationView
      reports={reports.data.items}
      status={status}
      onStatusChange={setStatus}
      onResolve={async (id, body) => {
        await resolveReport(id, body);
        await queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
        void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      }}
    />
  );
}
