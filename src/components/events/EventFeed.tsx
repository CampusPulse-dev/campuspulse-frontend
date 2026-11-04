import { fetchActiveStories, fetchEventFeed } from '@/lib/api';
import { HomeFeedClient } from './HomeFeedClient';
export async function EventFeed() {
  const [feed, stories] = await Promise.allSettled([fetchEventFeed(), fetchActiveStories()]);
  return (
    <HomeFeedClient
      initialEvents={feed.status === 'fulfilled' ? feed.value.items : []}
      initialCursor={feed.status === 'fulfilled' ? feed.value.nextCursor : null}
      initialError={feed.status === 'rejected' ? 'Events unavailable' : null}
      stories={stories.status === 'fulfilled' ? stories.value : []}
      storiesError={stories.status === 'rejected' ? 'Stories unavailable' : null}
    />
  );
}
