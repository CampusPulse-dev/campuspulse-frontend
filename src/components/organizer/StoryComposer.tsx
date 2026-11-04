'use client';

import { Trash2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField, TextArea } from '@/components/ui/Field';
import { ResourceState } from '@/components/attendee/Shared';
import {
  deleteStory,
  fetchStoryComposer,
  postStory,
  type StoryComposerData,
} from '@/lib/organizer-hub-data';
import {
  CAPTION_MAX,
  classifyMedia,
  IMAGE_TYPES,
  validateStory,
  VIDEO_TYPES,
  type StoryDraft,
  type StoryMediaType,
} from '@/lib/organizer-stories';
import { ClubGate } from './OrganizerGate';
import styles from './Organizer.module.css';

function hoursLeft(expiresAt: string, now: Date) {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - now.getTime()) / 3_600_000));
}

export function StoryComposerView({
  data,
  now = new Date(),
  onPost,
  onDelete,
}: {
  data: StoryComposerData;
  now?: Date;
  onPost: (draft: StoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const [eventId, setEventId] = useState('');
  const [mediaType, setMediaType] = useState<StoryMediaType | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function chooseMedia(file: File | undefined) {
    setPosted(false);
    setErrors([]);
    setMediaType(null);
    setPreview(null);
    if (!file) return;
    const result = classifyMedia(file);
    if ('error' in result) {
      setErrors([result.error]);
      return;
    }
    setMediaType(result.mediaType);
    setPreview(URL.createObjectURL(file));
  }

  async function post() {
    const draft: StoryDraft = { mediaType, caption, eventId: eventId || null };
    const found = validateStory(draft);
    setErrors(found);
    setPosted(false);
    if (found.length > 0) return;
    setBusy(true);
    try {
      await onPost(draft);
      setPosted(true);
      setCaption('');
      setEventId('');
      setMediaType(null);
      setPreview(null);
      setFileInputKey((key) => key + 1);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Could not post the story. Please retry.',
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      setDeleteBusy(true);
      await onDelete(id);
      setDeleting(null);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not delete the story.']);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerText}>
        <div className={styles.eyebrow}>{data.organizerName}</div>
        <h1>New story</h1>
        <p className={styles.stepSubtitle}>
          Stories show at the top of the campus feed and disappear after 24 hours.
        </p>
      </header>

      {!data.verified ? (
        <p className={styles.notice} role="status">
          Posting stories unlocks once your club is verified.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <ul className={styles.errorList} role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {posted ? (
        <p className={styles.notice} role="status">
          Story posted. It will disappear in 24 hours.
        </p>
      ) : null}

      <section className={styles.wizard} aria-label="Compose story">
        <div>
          <label className={styles.stepSubtitle} htmlFor="story-media">
            Photo or video
          </label>
          <input
            key={fileInputKey}
            id="story-media"
            type="file"
            accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')}
            onChange={(e) => chooseMedia(e.target.files?.[0])}
          />
          <p className={styles.stepSubtitle}>
            JPEG, PNG or WebP up to 5 MB, or MP4 or WebM up to 25 MB. Demo mode keeps the media on
            this device only.
          </p>
        </div>

        {preview && mediaType === 'IMAGE' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Story preview" className={styles.previewCover} />
        ) : null}
        {preview && mediaType === 'VIDEO' ? (
          <video src={preview} className={styles.previewCover} controls muted playsInline />
        ) : null}

        <TextArea
          label="Caption"
          hint={`${caption.length} / ${CAPTION_MAX}`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <SelectField
          label="Link to an event (optional)"
          hint="Viewers get a button that opens the event page."
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">No event link</option>
          {data.events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </SelectField>
        <div className={styles.actions}>
          <Button isLoading={busy} disabled={!data.verified} onClick={post}>
            Post story
          </Button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="active-stories">
        <h2 id="active-stories">Your active stories</h2>
        {data.stories.length === 0 ? (
          <p className={styles.muted}>No active stories right now.</p>
        ) : (
          <ul className={styles.eventList}>
            {data.stories.map((story, index) => (
              <li key={story.id} className={styles.eventRow}>
                <div className={styles.eventMain}>
                  <h3 className={styles.eventTitle}>{story.caption ?? 'Untitled story'}</h3>
                  <div className={styles.eventMeta}>
                    <Badge variant="default">
                      {story.mediaType === 'VIDEO' ? 'Video' : 'Photo'}
                    </Badge>
                    {story.eventTitle ? <span>Links to {story.eventTitle}</span> : null}
                    <span className={styles.mono}>
                      Expires in {hoursLeft(story.expiresAt, now)}h
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghostDanger"
                  size="sm"
                  aria-label={`Delete story ${index + 1}`}
                  onClick={() => setDeleting(story.id)}
                >
                  <Icon icon={Trash2} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal
        isOpen={!!deleting}
        title="Delete story?"
        subtitle="This removes it from your active stories."
        onClose={() => setDeleting(null)}
      >
        <Button
          variant="danger"
          isLoading={deleteBusy}
          onClick={() => deleting && void remove(deleting)}
        >
          Delete story
        </Button>
      </Modal>
    </div>
  );
}

function StoryComposerData({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['organizer-stories', slug],
    queryFn: () => fetchStoryComposer(slug),
  });
  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['organizer-stories', slug] }),
      queryClient.invalidateQueries({ queryKey: ['organizer-dashboard', slug] }),
    ]);
  return (
    <StoryComposerView
      data={query.data}
      onPost={async (draft) => {
        await postStory(slug, draft);
        await refresh();
      }}
      onDelete={async (id) => {
        await deleteStory(slug, id);
        await refresh();
      }}
    />
  );
}

export function StoryComposer({ slug }: { slug: string }) {
  return <ClubGate slug={slug}>{() => <StoryComposerData slug={slug} />}</ClubGate>;
}
