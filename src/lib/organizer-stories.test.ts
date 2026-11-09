import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mode', () => ({
  DEMO_MODE: true,
  DATA_MODE: 'demo',
  safeNext: (value: string | null) => value ?? '/',
}));

import {
  addStory,
  CAPTION_MAX,
  classifyMedia,
  IMAGE_MAX_BYTES,
  readActiveStories,
  removeStory,
  STORY_TTL_MS,
  validateStory,
  VIDEO_MAX_BYTES,
} from './organizer-stories';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('classifyMedia', () => {
  it('accepts photos and videos within their size limits', () => {
    expect(classifyMedia({ type: 'image/png', size: 1000 })).toEqual({ mediaType: 'IMAGE' });
    expect(classifyMedia({ type: 'video/mp4', size: 1000 })).toEqual({ mediaType: 'VIDEO' });
  });

  it('rejects oversized and unsupported files', () => {
    expect(classifyMedia({ type: 'image/jpeg', size: IMAGE_MAX_BYTES + 1 })).toHaveProperty(
      'error',
    );
    expect(classifyMedia({ type: 'video/webm', size: VIDEO_MAX_BYTES + 1 })).toHaveProperty(
      'error',
    );
    expect(classifyMedia({ type: 'image/gif', size: 10 })).toHaveProperty('error');
    expect(classifyMedia({ type: 'application/pdf', size: 10 })).toHaveProperty('error');
  });
});

describe('validateStory', () => {
  it('needs media and a caption within the limit', () => {
    expect(validateStory({ mediaType: null, caption: '', eventId: null })).toHaveLength(1);
    expect(validateStory({ mediaType: 'IMAGE', caption: '', eventId: null })).toEqual([]);
    expect(
      validateStory({ mediaType: 'IMAGE', caption: 'x'.repeat(CAPTION_MAX + 1), eventId: null }),
    ).toHaveLength(1);
    expect(
      validateStory({ mediaType: 'IMAGE', caption: 'x'.repeat(CAPTION_MAX), eventId: null }),
    ).toEqual([]);
  });
});

describe('story storage', () => {
  const draft = { mediaType: 'IMAGE' as const, caption: '  Doors open at 7  ', eventId: 'e1' };

  it('expires a story 24 hours after it was posted', () => {
    const now = new Date('2026-11-02T10:00:00.000Z');
    const story = addStory('club', draft, 'Havana Night', now);
    expect(Date.parse(story.expiresAt) - Date.parse(story.createdAt)).toBe(STORY_TTL_MS);
    expect(story.caption).toBe('Doors open at 7');
    expect(story.eventTitle).toBe('Havana Night');
    expect(readActiveStories('club', new Date('2026-11-03T09:59:00.000Z'))).toHaveLength(1);
    expect(readActiveStories('club', new Date('2026-11-03T10:00:00.000Z'))).toHaveLength(0);
  });

  it('drops the event title when the story has no event link', () => {
    const story = addStory('club', { ...draft, eventId: null }, 'Ignored', new Date());
    expect(story.eventTitle).toBeNull();
  });

  it('removes a story and keeps clubs separate', () => {
    const now = new Date();
    const a = addStory('club-a', draft, null, now);
    addStory('club-b', draft, null, now);
    removeStory('club-a', a.id, now);
    expect(readActiveStories('club-a', now)).toHaveLength(0);
    expect(readActiveStories('club-b', now)).toHaveLength(1);
  });

  it('refuses a story with no media', () => {
    expect(() => addStory('club', { ...draft, mediaType: null }, null, new Date())).toThrow();
  });
});
