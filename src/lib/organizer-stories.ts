import { readLocal, writeLocal } from './attendee-data';

/** Local story persistence for explicit demo mode. Live uploads and expiry are server-owned. */

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const CAPTION_MAX = 280;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];

export type StoryMediaType = 'IMAGE' | 'VIDEO';

export interface OrganizerStory {
  id: string;
  caption: string | null;
  eventId: string | null;
  eventTitle: string | null;
  mediaType: StoryMediaType;
  createdAt: string;
  expiresAt: string;
}

export interface StoryDraft {
  file?: File;
  mediaType: StoryMediaType | null;
  caption: string;
  eventId: string | null;
}

export function classifyMedia(file: {
  type: string;
  size: number;
}): { mediaType: StoryMediaType } | { error: string } {
  if (IMAGE_TYPES.includes(file.type)) {
    return file.size <= IMAGE_MAX_BYTES
      ? { mediaType: 'IMAGE' }
      : { error: 'Keep photos under 5 MB.' };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    return file.size <= VIDEO_MAX_BYTES
      ? { mediaType: 'VIDEO' }
      : { error: 'Keep videos under 25 MB.' };
  }
  return { error: 'Use a JPEG, PNG or WebP photo, or an MP4 or WebM video.' };
}

export function validateStory(draft: StoryDraft): string[] {
  const errors: string[] = [];
  if (!draft.mediaType) errors.push('Add a photo or video for your story.');
  if (draft.caption.length > CAPTION_MAX)
    errors.push(`Keep the caption under ${CAPTION_MAX} characters.`);
  return errors;
}

function storageKey(slug: string) {
  return `organizer:${slug}:stories`;
}

/** Stories expire on their own; anything past `expiresAt` is treated as gone. */
export function readActiveStories(slug: string, now: Date): OrganizerStory[] {
  return readLocal<OrganizerStory[]>(storageKey(slug), []).filter(
    (story) => Date.parse(story.expiresAt) > now.getTime(),
  );
}

export function addStory(
  slug: string,
  draft: StoryDraft,
  eventTitle: string | null,
  now: Date,
): OrganizerStory {
  if (!draft.mediaType) throw new Error('Add a photo or video for your story.');
  const caption = draft.caption.trim();
  const story: OrganizerStory = {
    id: `demo-story-${now.getTime()}`,
    caption: caption || null,
    eventId: draft.eventId,
    eventTitle: draft.eventId ? eventTitle : null,
    mediaType: draft.mediaType,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STORY_TTL_MS).toISOString(),
  };
  writeLocal(storageKey(slug), [story, ...readActiveStories(slug, now)]);
  return story;
}

export function removeStory(slug: string, id: string, now: Date): void {
  writeLocal(
    storageKey(slug),
    readActiveStories(slug, now).filter((story) => story.id !== id),
  );
}
