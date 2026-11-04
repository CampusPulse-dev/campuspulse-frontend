import React from 'react';
import { Check } from 'lucide-react';
import { Icon } from './Icon';
import styles from './Avatar.module.css';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isVerified?: boolean;
  hasStoryRing?: boolean;
  isStoryViewed?: boolean;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'CP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  isVerified = false,
  hasStoryRing = false,
  isStoryViewed = false,
}: AvatarProps) {
  const wrapperClass = [
    styles.wrapper,
    styles[size],
    hasStoryRing ? (isStoryViewed ? styles.storyViewed : styles.storyActive) : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={wrapperClass} title={name}>
      <span className={styles.inner}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className={styles.image} />
        ) : (
          <span className={styles.initials} aria-label={name}>
            {getInitials(name)}
          </span>
        )}
      </span>
      {isVerified ? (
        <span className={styles.verifiedBadge} aria-label="Verified" title="Verified">
          <Icon icon={Check} size={14} />
        </span>
      ) : null}
    </span>
  );
}

export interface MutualFriend {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FriendAvatarStackProps {
  friends: MutualFriend[];
  totalCount?: number;
}

export function FriendAvatarStack({ friends, totalCount }: FriendAvatarStackProps) {
  if (friends.length === 0) return null;

  const visible = friends.slice(0, 3);
  const count = totalCount ?? friends.length;
  const firstNames = visible.slice(0, 2).map((f) => f.displayName.split(' ')[0]);
  const extraCount = Math.max(0, count - firstNames.length);

  const summary =
    extraCount > 0
      ? `${firstNames.join(', ')} +${extraCount} ${extraCount === 1 ? 'friend' : 'friends'} going`
      : `${firstNames.join(' & ')} going`;

  return (
    <div className={styles.stackRow}>
      <div className={styles.stackAvatars} aria-hidden="true">
        {visible.map((friend) => (
          <div key={friend.id} className={styles.stackItem}>
            <Avatar name={friend.displayName} src={friend.avatarUrl} size="sm" />
          </div>
        ))}
      </div>
      <span className={styles.stackLabel}>{summary}</span>
    </div>
  );
}
