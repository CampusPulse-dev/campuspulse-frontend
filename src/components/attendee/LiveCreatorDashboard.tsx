'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiRequestError, type Schemas } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { ResourceState, styles } from './Shared';

export function LiveCreatorDashboard() {
  const { user } = useAuth();
  const queries = useQueryClient();
  const [eventId, setEventId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const links = useQuery({
    queryKey: ['creator-links', user?.id],
    queryFn: () =>
      apiFetch<Schemas['CreatorAmbassadorLinksResponse']>('/creators/me/ambassador-links', {
        cache: 'no-store',
      }),
    retry: false,
  });
  const events = useQuery({
    queryKey: ['creator-events', user?.id],
    queryFn: () => apiFetch<Schemas['FeedResponse']>('/events/feed?limit=50'),
  });
  if (!links.data) {
    if (links.error instanceof ApiRequestError && links.error.error.statusCode === 404)
      return <p>Apply for a creator profile before generating ambassador links.</p>;
    return <ResourceState pending={links.isPending} error={links.error} retry={links.refetch} />;
  }
  return (
    <section className={styles.panel}>
      <h2>Ambassador links</h2>
      {!links.data.creator.isVerified ? (
        <p>Your creator verification is pending.</p>
      ) : (
        <>
          <SelectField label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Choose an event</option>
            {events.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </SelectField>
          <Button
            disabled={!eventId}
            isLoading={busy}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                await apiFetch<Schemas['AmbassadorLinkResponse']>('/attendance/ambassador-links', {
                  method: 'POST',
                  body: JSON.stringify({ eventId }),
                });
                await queries.invalidateQueries({ queryKey: ['creator-links', user?.id] });
                setMessage('Link ready.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Could not generate link.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Generate link
          </Button>
        </>
      )}
      {links.data.items.map((link) => (
        <section key={link.id}>
          <h3>{link.event.title}</h3>
          <TextField label={`Your link for ${link.event.title}`} value={link.shareUrl} readOnly />
          <p>
            Attributed RSVPs: {link.rsvpCount} · Check-ins: {link.checkInCount}
          </p>
        </section>
      ))}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
