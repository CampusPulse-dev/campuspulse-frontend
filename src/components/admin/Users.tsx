'use client';

import React, { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResourceState } from '@/components/attendee/Shared';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField, ToggleRow } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ROLE_LABELS } from '@/lib/admin-access';
import {
  fetchUsers,
  setUserSuspension,
  updateUserRole,
  validateUserSearch,
  type AdminUser,
} from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import { ConfirmDialog, PageHeader, type ConfirmRequest } from './AdminBits';
import styles from './Admin.module.css';

const ROLES = Object.keys(ROLE_LABELS) as AdminUser['role'][];

export function UsersView({
  users,
  meId,
  search,
  staffOnly,
  onSearch,
  onStaffOnly,
  onRole,
  onSuspension,
}: {
  users: AdminUser[];
  meId: string;
  search: string;
  staffOnly: boolean;
  onSearch: (search: string) => void;
  onStaffOnly: (staffOnly: boolean) => void;
  onRole: (id: string, role: AdminUser['role']) => Promise<void>;
  onSuspension: (id: string, suspended: boolean, note: string) => Promise<void>;
}) {
  const { pushToast } = useToast();
  const [draft, setDraft] = useState(search);
  const [searchProblem, setSearchProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  function submitSearch() {
    const problem = validateUserSearch(draft);
    setSearchProblem(problem);
    if (!problem) onSearch(draft.trim());
  }

  function changeRole(user: AdminUser, role: AdminUser['role']) {
    if (role === user.role) return;
    setConfirm({
      title: `Make ${user.displayName} ${ROLE_LABELS[role]}?`,
      subtitle: `They are ${ROLE_LABELS[user.role]} now. The change applies the next time they load a page.`,
      confirmLabel: 'Change role',
      note: 'none',
      run: async () => {
        await onRole(user.id, role);
        pushToast(`${user.displayName} is now ${ROLE_LABELS[role]}.`, 'success');
      },
    });
  }

  function changeSuspension(user: AdminUser) {
    const suspend = user.suspendedAt === null;
    setConfirm({
      title: suspend ? `Suspend ${user.displayName}?` : `Reinstate ${user.displayName}?`,
      subtitle: suspend
        ? 'They are signed out everywhere and cannot sign back in.'
        : 'They will be able to sign in again.',
      confirmLabel: suspend ? 'Suspend' : 'Reinstate',
      danger: suspend,
      note: 'required',
      noteLabel: 'Reason (kept in the audit log)',
      run: async (note) => {
        await onSuspension(user.id, suspend, note ?? '');
        pushToast(suspend ? 'Account suspended.' : 'Account reinstated.', 'info');
      },
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Platform" title="Users & roles">
        Give staff the smallest role that lets them do their job. Email addresses are always masked
        here.
      </PageHeader>

      <form
        noValidate
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <TextField
          label="Search by name"
          type="search"
          autoComplete="off"
          value={draft}
          error={searchProblem}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <ToggleRow
          label="Staff only"
          checked={staffOnly}
          onChange={(event) => onStaffOnly(event.target.checked)}
        />
      </form>

      {users.length === 0 ? (
        <p className={styles.empty}>No one matches that search.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className={styles.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const self = user.id === meId;
                return (
                  <tr key={user.id}>
                    <th scope="row">
                      {user.displayName}
                      {self ? ' (you)' : ''}
                    </th>
                    <td className={styles.mono}>{user.emailHint}</td>
                    <td>
                      <select
                        aria-label={`Role for ${user.displayName}`}
                        value={user.role}
                        disabled={self}
                        onChange={(event) =>
                          changeRole(user, event.target.value as AdminUser['role'])
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {user.suspendedAt ? (
                        <Badge variant="danger">Suspended</Badge>
                      ) : user.isVerifiedStudent ? (
                        <Badge variant="success">Verified student</Badge>
                      ) : (
                        <span className={styles.muted}>Active</span>
                      )}
                    </td>
                    <td>
                      {self ? null : (
                        <Button
                          size="sm"
                          variant={user.suspendedAt ? 'secondary' : 'ghostDanger'}
                          onClick={() => changeSuspension(user)}
                        >
                          {user.suspendedAt ? 'Reinstate' : 'Suspend'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [staffOnly, setStaffOnly] = useState(true);
  const users = useQuery({
    queryKey: ['admin', 'users', search, staffOnly],
    queryFn: () => fetchUsers({ search, staffOnly }),
    placeholderData: keepPreviousData,
  });
  if (!user) return null;
  if (!users.data)
    return <ResourceState pending={users.isPending} error={users.error} retry={users.refetch} />;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };
  return (
    <UsersView
      users={users.data.items}
      meId={user.id}
      search={search}
      staffOnly={staffOnly}
      onSearch={setSearch}
      onStaffOnly={setStaffOnly}
      onRole={async (id, role) => {
        await updateUserRole(id, role);
        await refresh();
      }}
      onSuspension={async (id, suspended, note) => {
        await setUserSuspension(id, { suspended, note });
        await refresh();
      }}
    />
  );
}
