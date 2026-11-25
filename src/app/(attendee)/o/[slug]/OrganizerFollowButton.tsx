'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import styles from './OrganizerProfile.module.css';
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

export function OrganizerFollowButton({
  organizerId,
  initialFollowerCount,
}: {
  organizerId: string;
  initialFollowerCount: number;
}) {
  const { followedOrganizerIds, toggleFollowOrganizer } = useAuth();
  const { pushToast } = useToast();
  const isFollowing = followedOrganizerIds.includes(organizerId);
  const [delta, setDelta] = useState(0);

  async function handleClick() {
    // The button and count flip on this frame; a failure puts both back.
    const step = isFollowing ? -1 : 1;
    try {
      setDelta((prev) => prev + step);
      const nowFollowing = await toggleFollowOrganizer(organizerId);
      if (nowFollowing === null) {
        setDelta((prev) => prev - step);
        return;
      }
      pushToast(
        nowFollowing
          ? 'Following club — new stories & events will appear first in your feed.'
          : 'Unfollowed club.',
        'info',
      );
    } catch (e) {
      setDelta((prev) => prev - step);
      pushToast(e instanceof Error ? e.message : 'Unable to follow', 'warning');
    }
  }

  return (
    <div className={styles.followWrap}>
      <span className={styles.followerCount}>
        {(initialFollowerCount + delta).toLocaleString()} followers
      </span>
      <Button variant={isFollowing ? 'secondary' : 'primary'} size="sm" onClick={handleClick}>
        {isFollowing ? (
          <>
            <Icon icon={Check} size={16} />
            Following
          </>
        ) : (
          'Follow club'
        )}
      </Button>
    </div>
  );
}
