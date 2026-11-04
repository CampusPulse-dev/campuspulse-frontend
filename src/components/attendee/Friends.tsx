'use client';
import { TextField, SelectField } from '@/components/ui/Field';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/mode';
import {
  attendeeRequest,
  demoFriends,
  readLocal,
  writeLocal,
  type FriendEntry,
} from '@/lib/attendee-data';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { AccountGate, PageFrame, ResourceState, styles } from './Shared';
export function Friends() {
  const { user, accessToken, persona } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [cohort, setCohort] = useState('ALL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = `friends:${user?.id}`;
  const query = useQuery({
    queryKey: ['friends', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () =>
      DEMO_MODE
        ? readLocal<FriendEntry[]>(key, demoFriends)
        : (await attendeeRequest('FriendsResponse', '/friends', accessToken)).items,
  });
  async function action(friend: FriendEntry, kind: 'REQUEST' | 'ACCEPT' | 'DECLINE' | 'BLOCK') {
    setError('');
    setBusy(true);
    try {
      if (DEMO_MODE) {
        const next = (query.data ?? []).flatMap((f) =>
          f.id !== friend.id
            ? [f]
            : kind === 'DECLINE'
              ? []
              : [
                  {
                    ...f,
                    status: (kind === 'ACCEPT'
                      ? 'ACCEPTED'
                      : kind === 'BLOCK'
                        ? 'BLOCKED'
                        : 'OUTGOING') as FriendEntry['status'],
                  },
                ],
        );
        writeLocal(key, next);
      } else
        await attendeeRequest(
          'FriendEntry',
          kind === 'REQUEST' ? '/friends/request' : `/friends/${friend.id}/respond`,
          accessToken,
          'POST',
          { ...(kind === 'REQUEST' ? { userId: friend.user.id } : {}), action: kind },
        );
      await client.invalidateQueries({ queryKey: ['friends', user?.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update friendship.');
    } finally {
      setBusy(false);
    }
  }
  const visible = (query.data ?? []).filter(
    (f) =>
      f.status !== 'BLOCKED' &&
      f.user.displayName.toLowerCase().includes(search.toLowerCase()) &&
      (cohort === 'ALL' ||
        (cohort === 'HALL'
          ? !!persona?.hall && f.hall === persona.hall
          : !!persona?.faculty && f.faculty === persona.faculty)),
  );
  return (
    <PageFrame
      title="Your people"
      subtitle="Make plans with friends. Discover familiar faces from your hall and faculty."
    >
      <AccountGate>
        <div className={styles.row}>
          <TextField
            label={<>Search people</>}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
          />
          <SelectField
            label={<>Suggestions</>}
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
          >
            <option value="ALL">All campus</option>
            <option value="HALL">My hall</option>
            <option value="FACULTY">My faculty</option>
          </SelectField>
        </div>
        <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <Section title="On campus">
          {visible.map((f) => (
            <ListRow
              key={f.id}
              leading={<Avatar name={f.user.displayName} />}
              title={f.user.displayName}
              meta={
                <>
                  {f.hall} · {f.faculty}
                  <br />
                  {f.status === 'INCOMING'
                    ? 'Wants to connect'
                    : f.status === 'OUTGOING'
                      ? 'Request sent'
                      : f.status === 'ACCEPTED'
                        ? 'Friends'
                        : 'Suggested for you'}
                </>
              }
              trailing={
                <div className={styles.actions}>
                  {f.status === 'INCOMING' ? (
                    <>
                      <Button disabled={busy} onClick={() => action(f, 'ACCEPT')}>
                        Accept
                      </Button>
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() => action(f, 'DECLINE')}
                      >
                        Decline
                      </Button>
                    </>
                  ) : f.status === 'SUGGESTED' ? (
                    <Button disabled={busy} onClick={() => action(f, 'REQUEST')}>
                      Add friend
                    </Button>
                  ) : null}
                  <Button disabled={busy} variant="ghost" onClick={() => action(f, 'BLOCK')}>
                    Block
                  </Button>
                </div>
              }
            />
          ))}
        </Section>
        {!query.isPending && !query.error && visible.length === 0 ? (
          <p>No people match these filters. Try all campus.</p>
        ) : null}
        <a
          href={`https://wa.me/?text=${encodeURIComponent('Join me on CampusPulse — discover what is happening at UI: https://campuspulse.ng/sign-up')}`}
          target="_blank"
          rel="noreferrer"
        >
          Invite a friend on WhatsApp →
        </a>
      </AccountGate>
    </PageFrame>
  );
}
