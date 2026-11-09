'use client';
import { TextField } from '@/components/ui/Field';
import { useClientReady } from '@/lib/use-client-ready';
import { useEffect, useState } from 'react';
import { ListRow } from '@/components/ui/ListRow';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { useQuery } from '@tanstack/react-query';
import { presentEvents, searchCampus } from '@/lib/attendee-data';
import { EventCard } from '@/components/events/EventCard';
import { PageFrame, ResourceState, styles } from './Shared';
export function Search() {
  const hydrated = useClientReady();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useQuery({
    queryKey: ['search', search],
    queryFn: ({ signal }) => searchCampus(search, signal),
    enabled: search.length > 0,
    retry: false,
  });
  return (
    <PageFrame
      title="Find your next plan"
      subtitle="Search events, venues, and verified clubs across campus."
    >
      <TextField
        label={<>Search campus</>}
        disabled={!hydrated}
        autoFocus
        type="search"
        placeholder="Try a club, event, or venue"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {!search ? (
        <p className={styles.muted}>Start typing to explore campus.</p>
      ) : (
        <>
          <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />
          <div aria-live="polite">
            {query.data ? (
              <>
                <h2>Verified clubs</h2>
                <div className={styles.list}>
                  {query.data.organizers
                    .filter((o) => o.isVerified)
                    .map((o) => (
                      <ListRow
                        key={o.id}
                        href={'/o/' + o.slug}
                        title={
                          <>
                            {o.name} <VerifiedMark />
                          </>
                        }
                        meta={o.bio}
                      />
                    ))}
                </div>
                <h2>Events</h2>
                <div className={styles.list}>
                  {presentEvents(query.data.events).map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
                {query.data.events.length + query.data.organizers.length === 0 ? (
                  <p>No matches. Try another event, venue, or club.</p>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      )}
    </PageFrame>
  );
}
