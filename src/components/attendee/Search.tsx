'use client';
import { TextField } from '@/components/ui/Field';
import { useClientReady } from '@/lib/use-client-ready';
import { useEffect, useState } from 'react';
import { ListRow } from '@/components/ui/ListRow';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { useQuery } from '@tanstack/react-query';
import { presentEvents, searchCampus } from '@/lib/attendee-data';
import { EventCard } from '@/components/events/EventCard';
import { fetchEventFeed } from '@/lib/api';
import { Suggestions } from '@/components/ui/EmptyState';
import { EventCardsSkeleton } from '@/components/ui/Skeleton';
import { PageFrame, ResourceState, styles } from './Shared';

/** Starter searches, so the page has somewhere to go before anyone types. */
const QUICK_SEARCHES = ['Havana', 'Theatre', 'Inter-hall', 'Tech summit', 'Afterparty', 'Zik'];
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
  const discover = useQuery({
    queryKey: ['search-discover'],
    enabled: !search,
    retry: false,
    queryFn: async () => (await fetchEventFeed()).items,
  });
  const clubs = [
    ...new Map(
      (discover.data ?? [])
        .filter((e) => e.organizer.isVerified)
        .map((e) => [e.organizer.id, e.organizer]),
    ).values(),
  ].slice(0, 4);
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
        <div className={styles.discover}>
          <Suggestions title="Try searching for">
            <div className={styles.chips}>
              {QUICK_SEARCHES.map((q) => (
                <button key={q} type="button" className={styles.chip} onClick={() => setInput(q)}>
                  {q}
                </button>
              ))}
            </div>
          </Suggestions>
          <Suggestions title="Trending this week">
            {discover.isPending ? (
              <EventCardsSkeleton count={3} label="Loading events…" />
            ) : (
              <div className={styles.grid}>
                {(discover.data ?? []).slice(0, 3).map((e) => (
                  <EventCard key={e.id} event={e} compact />
                ))}
              </div>
            )}
          </Suggestions>
          {clubs.length ? (
            <Suggestions title="Verified clubs">
              <div className={styles.list}>
                {clubs.map((o) => (
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
            </Suggestions>
          ) : null}
        </div>
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
