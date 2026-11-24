'use client';
import { TextField, SelectField } from '@/components/ui/Field';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/mode';
import {
  attendeeRequest,
  demoFriends,
  readLocal,
  sendFriendAction,
  writeLocal,
  type FriendEntry,
} from '@/lib/attendee-data';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import buttonStyles from '@/components/ui/Button.module.css';
import { useFriendIntents } from './FriendIntentProvider';
import { AccountGate, PageFrame, ResourceState, styles } from './Shared';
export function Friends() {
  const { user, accessToken, persona } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [cohort, setCohort] = useState('ALL');
  const [error, setError] = useState('');
  const active = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const { pending, queue } = useFriendIntents();
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
    const peer = friend.user.id;
    const guard = JSON.stringify([user?.id, peer]);
    if (!user || active.current.has(guard) || pending.has(peer)) return;
    active.current.add(guard);
    setBusy(new Set(active.current));
    setError('');
    try {
      if (kind === 'BLOCK' || kind === 'DECLINE') {
        await queue(friend, kind);
        return;
      }
      if (DEMO_MODE) {
        const entries = readLocal(key, demoFriends);
        writeLocal(
          key,
          entries.map((entry) =>
            entry.user.id === peer
              ? { ...entry, status: kind === 'ACCEPT' ? 'ACCEPTED' : 'OUTGOING' }
              : entry,
          ),
        );
      } else {
        await sendFriendAction(
          user.id,
          kind === 'REQUEST' ? '/friends/request' : `/friends/${friend.id}/respond`,
          accessToken,
          kind === 'REQUEST' ? { userId: peer } : { action: kind },
        );
      }
      await client.invalidateQueries({ queryKey: ['friends', user.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update friendship.');
    } finally {
      active.current.delete(guard);
      setBusy(new Set(active.current));
    }
  }
  const visible = (query.data ?? []).filter(
    (f) =>
      f.status !== 'BLOCKED' &&
      !pending.has(f.user.id) &&
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
                      <Button
                        disabled={busy.has(JSON.stringify([user?.id, f.user.id]))}
                        onClick={() => action(f, 'ACCEPT')}
                      >
                        Accept
                      </Button>
                      <Button
                        disabled={busy.has(JSON.stringify([user?.id, f.user.id]))}
                        variant="secondary"
                        onClick={() => action(f, 'DECLINE')}
                      >
                        Decline
                      </Button>
                    </>
                  ) : f.status === 'SUGGESTED' ? (
                    <Button
                      disabled={busy.has(JSON.stringify([user?.id, f.user.id]))}
                      onClick={() => action(f, 'REQUEST')}
                    >
                      Add friend
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy.has(JSON.stringify([user?.id, f.user.id]))}
                    variant="ghost"
                    onClick={() => action(f, 'BLOCK')}
                  >
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
          className={buttonStyles.textLink}
        >
          Invite a friend on WhatsApp →
        </a>
      </AccountGate>
    </PageFrame>
  );
}
