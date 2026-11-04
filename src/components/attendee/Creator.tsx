'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, type Schemas } from '@/lib/api';
import { DEMO_MODE } from '@/lib/mode';
import { readLocal, writeLocal, presentEvents } from '@/lib/attendee-data';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/events/EventCard';
import { PageFrame, styles } from './Shared';
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
export function Creator({ creator }: { creator: Schemas['CreatorPublic'] }) {
  const { user, accessToken } = useAuth();
  const client = useQueryClient();
  const followKey = ['creator-follow', user?.id, creator.id];
  const followState = useQuery({
    queryKey: followKey,
    enabled: !!user,
    queryFn: async () =>
      DEMO_MODE
        ? readLocal<string[]>(`creator-follows:${user!.id}`, []).includes(creator.id)
        : false,
  });
  const following = followState.data ?? false;
  const [message, setMessage] = useState('');
  async function follow() {
    try {
      if (!user) throw new Error('Sign in to follow creators.');
      const key = `creator-follows:${user.id}`;
      const previous = DEMO_MODE ? readLocal<string[]>(key, []) : [];
      const next = !following;
      if (!DEMO_MODE)
        await apiFetch(`/creators/${creator.id}/follow`, {
          method: next ? 'POST' : 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      else
        writeLocal(
          key,
          next ? [...previous, creator.id] : previous.filter((id) => id !== creator.id),
        );
      client.setQueryData(followKey, next);
      setMessage(next ? 'Following creator.' : 'Unfollowed creator.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to follow.');
    }
  }
  return (
    <PageFrame
      title={creator.displayName}
      subtitle={`@${creator.handle} · ${creator.isVerified ? 'Verified creator' : 'Campus creator'}`}
    >
      <section className={styles.panel}>
        <Avatar name={creator.displayName} src={creator.avatarUrl} size="lg" />
        <p>{creator.bio}</p>
        <div className={styles.spread}>
          <span>{creator.followerCount + (following ? 1 : 0)} followers</span>
          <Button onClick={follow} variant={following ? 'secondary' : 'primary'}>
            {following ? (
              <>
                <Icon icon={Check} size={16} />
                Following
              </>
            ) : (
              'Follow creator'
            )}
          </Button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </section>
      <h2>On their radar</h2>
      {presentEvents(creator.events).map((e) => (
        <EventCard event={e} key={e.id} />
      ))}
    </PageFrame>
  );
}
