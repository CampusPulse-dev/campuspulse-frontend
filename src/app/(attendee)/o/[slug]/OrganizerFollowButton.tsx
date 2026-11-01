'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import styles from './OrganizerProfile.module.css';

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
    try {
      const nowFollowing = await toggleFollowOrganizer(organizerId);
      setDelta((prev) => (nowFollowing ? prev + 1 : prev - 1));
      pushToast(
        nowFollowing
          ? 'Following club — new stories & events will appear first in your feed.'
          : 'Unfollowed club.',
        'info',
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Unable to follow', 'warning');
    }
  }

  return (
    <div className={styles.followWrap}>
      <span className={styles.followerCount}>
        {(initialFollowerCount + delta).toLocaleString()} followers
      </span>
      <Button variant={isFollowing ? 'secondary' : 'primary'} size="sm" onClick={handleClick}>
        {isFollowing ? '✓ Following' : '+ Follow Club'}
      </Button>
    </div>
  );
}
