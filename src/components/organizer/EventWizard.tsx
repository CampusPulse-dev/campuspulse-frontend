'use client';
import { DEMO_MODE } from '@/lib/mode';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { CATEGORY_LABELS, CategoryPill } from '@/components/ui/Badge';
import { SelectField, TextArea, TextField, ToggleRow } from '@/components/ui/Field';
import { formatWatDateTime } from '@/lib/campus-data';
import { WizardStep as AnimatedStep } from '@/components/ui/WizardStep';
import { shake } from '@/lib/use-field-errors';
import type { EventCategory } from '@/lib/api';
import {
  defaultStudentsOnly,
  emptyDraft,
  lagosLocalToIso,
  ORGANIZER_CATEGORIES,
  TEMPLATE_BLOCKS,
  TEMPLATE_LABELS,
  validateDraftForPublish,
  validateDraftForSave,
  validateStep,
  type AfterPartyAccessRule,
  type EventDraft,
  type WizardStep,
} from '@/lib/organizer-data';
import type { EventTemplateType } from '@/lib/campus-data';
import styles from './Organizer.module.css';

const TEMPLATES = Object.keys(TEMPLATE_LABELS) as EventTemplateType[];
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ACCESS_RULES: { value: AfterPartyAccessRule; label: string }[] = [
  { value: 'OPEN', label: 'Open to everyone' },
  { value: 'PRIORITY_CHECKED_IN', label: 'Checked-in guests get priority' },
  { value: 'CHECKED_IN_ONLY', label: 'Checked-in guests only' },
];

export interface EventWizardProps {
  canPublish: boolean;
  initialDraft?: EventDraft;
  /** Published events of this club that an after-party can attach to. */
  parentOptions: { id: string; title: string }[];
  onSaveDraft: (draft: EventDraft) => Promise<void>;
  onPublish: (draft: EventDraft) => Promise<void>;
  /**
   * localStorage key for keeping unsaved work on this device. A new event is
   * restored from it on return, and the key is cleared once the server has
   * the draft. Omit it when editing a saved draft (the server copy wins).
   */
  autosaveKey?: string;
}

interface LocalWizardCopy {
  draft: EventDraft;
  step: WizardStep;
  savedAt: number;
}

const AUTOSAVE_DELAY_MS = 600;

/** Which field a validation message belongs to, so it can sit beside it. */
type FieldKey =
  'category' | 'title' | 'description' | 'startsAt' | 'endsAt' | 'venueName' | 'capacity' | 'cover';
const FIELD_PATTERNS: [FieldKey, RegExp][] = [
  ['category', /category/i],
  ['cover', /cover image/i],
  ['title', /title/i],
  ['description', /description/i],
  ['endsAt', /ends|end after/i],
  ['startsAt', /starts/i],
  ['venueName', /venue/i],
  ['capacity', /capacity/i],
];
const FIELD_STEP: Record<FieldKey, WizardStep> = {
  category: 1,
  title: 2,
  description: 2,
  startsAt: 2,
  endsAt: 2,
  venueName: 2,
  capacity: 2,
  cover: 2,
};
function fieldFor(message: string): FieldKey | null {
  return FIELD_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
}
/** The check that last failed; it re-runs on every change so messages clear as fixed. */
type CheckMode = { kind: 'step'; step: WizardStep } | { kind: 'draft' } | { kind: 'publish' };
function runCheck(mode: CheckMode, draft: EventDraft) {
  return mode.kind === 'step'
    ? validateStep(mode.step, draft)
    : mode.kind === 'draft'
      ? validateDraftForSave(draft)
      : validateDraftForPublish(draft);
}

function clearLocalCopy(key?: string) {
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Device storage can be unavailable. */
  }
}

function readLocalCopy(key: string | undefined): LocalWizardCopy | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalWizardCopy) : null;
  } catch {
    return null;
  }
}

export function EventWizard({
  canPublish,
  initialDraft,
  parentOptions,
  onSaveDraft,
  onPublish,
  autosaveKey,
}: EventWizardProps) {
  // Read once on mount: a new event picks up where this device left off.
  const [restored] = useState(() => (initialDraft ? null : readLocalCopy(autosaveKey)));
  const [step, setStep] = useState<WizardStep>(restored?.step ?? 1);
  const [draft, setDraft] = useState<EventDraft>(
    () => restored?.draft ?? initialDraft ?? emptyDraft(),
  );
  const [showRestored, setShowRestored] = useState(Boolean(restored));
  const [baseline] = useState(() => JSON.stringify(initialDraft ?? emptyDraft()));
  const dirty = JSON.stringify(draft) !== baseline;
  const settled = useRef(false);
  const stored = useRef(Boolean(restored));
  // Server failures; validation messages are derived from `check` below.
  const [errors, setErrors] = useState<string[]>([]);
  const [check, setCheck] = useState<CheckMode | null>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initialDraft?.coverDataUrl ?? null,
  );
  const [coverError, setCoverError] = useState<string | null>(null);
  const studentsOnlyTouched = useRef(Boolean(initialDraft));
  const blocks = TEMPLATE_BLOCKS[draft.template];

  useEffect(
    () => () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  // A single write path covers the debounce and departure. The latest
  // committed render is available to the unmount and page lifecycle handlers.
  const flushCopy = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    flushCopy.current = () => {
      if (!autosaveKey || initialDraft || settled.current) return;
      if (!dirty) {
        if (stored.current) clearLocalCopy(autosaveKey);
        stored.current = false;
        return;
      }
      try {
        const copy: LocalWizardCopy = {
          draft: { ...draft, coverDataUrl: null },
          step,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(autosaveKey, JSON.stringify(copy));
        stored.current = true;
      } catch {
        // The leave guard still covers changes when device storage is unavailable.
      }
    };
  }, [autosaveKey, initialDraft, dirty, draft, step]);
  useEffect(() => {
    const timer = window.setTimeout(() => flushCopy.current(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autosaveKey, dirty, draft, step]);
  useEffect(() => {
    const flush = () => flushCopy.current();
    const onVisibility = () => {
      if (document.hidden) flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // Warn before a reload or tab close would drop unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    function guard(event: BeforeUnloadEvent) {
      if (settled.current) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  function startOver() {
    flushCopy.current = () => {};
    clearLocalCopy(autosaveKey);
    setDraft(emptyDraft());
    setStep(1);
    setErrors([]);
    setCheck(null);
    setCoverPreview(null);
    setShowRestored(false);
    studentsOnlyTouched.current = false;
  }

  function patch(next: Partial<EventDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function nextRowId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  function chooseCategory(value: string) {
    const category = (value || null) as EventCategory | null;
    patch({
      category,
      ...(studentsOnlyTouched.current ? {} : { studentsOnly: defaultStudentsOnly(category) }),
    });
  }

  function chooseCover(file: File | undefined) {
    setCoverError(null);
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) {
      setCoverError('Use a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('Keep the cover image under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverPreview(reader.result);
        patch({ coverDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  /** Show the failures, then move focus to (and shake) the first field on screen. */
  function fail(mode: CheckMode, found: string[]) {
    setCheck(mode);
    const key = found.map(fieldFor).find((field) => field && FIELD_STEP[field] === step);
    window.requestAnimationFrame(() => {
      const target = key
        ? wizardRef.current?.querySelector<HTMLElement>(`section:not([inert]) [name="${key}"]`)
        : wizardRef.current?.querySelector<HTMLElement>('[data-error-summary]');
      if (!target) return;
      target.focus();
      if (key) shake(target);
    });
  }

  function goNext() {
    const mode: CheckMode = { kind: 'step', step };
    const found = runCheck(mode, draft);
    setErrors([]);
    if (found.length > 0) return fail(mode, found);
    setCheck(null);
    setStep((step + 1) as WizardStep);
  }

  function goBack() {
    setErrors([]);
    setCheck(null);
    setStep((step - 1) as WizardStep);
  }

  async function run(kind: 'draft' | 'publish') {
    const mode: CheckMode = { kind: kind === 'draft' ? 'draft' : 'publish' };
    const found = runCheck(mode, draft);
    setErrors([]);
    if (found.length > 0) return fail(mode, found);
    setCheck(null);
    setBusy(kind);
    try {
      await (kind === 'draft' ? onSaveDraft(draft) : onPublish(draft));
      // The server has it now: drop the device copy and the leave guard.
      settled.current = true;
      clearLocalCopy(autosaveKey);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Something went wrong. Please retry.']);
    } finally {
      setBusy(null);
    }
  }

  const when = draft.startsAt ? formatWatDateTime(lagosLocalToIso(draft.startsAt)) : null;
  const problems = check ? runCheck(check, draft) : [];
  /** The first message for a field on this step, shown under that field. */
  const errorFor = (key: FieldKey) =>
    FIELD_STEP[key] === step
      ? (problems.find((message) => fieldFor(message) === key) ?? null)
      : null;
  // Anything without a field on this step stays in the list at the top.
  const summary = [
    ...problems.filter((message) => {
      const key = fieldFor(message);
      return !key || FIELD_STEP[key] !== step;
    }),
    ...errors,
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.wizard} ref={wizardRef}>
        <ol className={styles.wizardSteps} aria-label="Event setup">
          {['Template', 'Details', 'Lineup'].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
              {index + 1} {label}
            </li>
          ))}
        </ol>

        {showRestored && restored ? (
          <div className={styles.notice} role="status">
            <p className={styles.restoredText}>
              Picked up your unsaved event from{' '}
              {new Date(restored.savedAt).toLocaleString('en-NG', {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
              . Add the cover image again before saving.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" size="sm" onClick={() => setShowRestored(false)}>
                Keep going
              </Button>
              <Button variant="ghost" size="sm" onClick={startOver}>
                Start over
              </Button>
            </div>
          </div>
        ) : null}

        {summary.length > 0 ? (
          <ul className={styles.errorList} role="alert" tabIndex={-1} data-error-summary>
            {summary.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <AnimatePresence mode="popLayout" initial={false}>
          <AnimatedStep key={step} className={styles.stepSection}>
            {step === 1 ? (
              <>
                <h2 className={styles.stepTitle}>Template &amp; category</h2>
                <p className={styles.stepSubtitle}>
                  The template decides which details you fill in on the last step.
                </p>
                <div className={styles.templateGrid} role="group" aria-label="Event template">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      aria-pressed={draft.template === template}
                      className={`${styles.templateCard} ${draft.template === template ? styles.templateCardActive : ''}`}
                      onClick={() => patch({ template })}
                    >
                      <span className={styles.templateLabel}>
                        {TEMPLATE_LABELS[template].label}
                      </span>
                      <span className={styles.templateBlurb}>
                        {TEMPLATE_LABELS[template].blurb}
                      </span>
                    </button>
                  ))}
                </div>
                <SelectField
                  label="Category"
                  name="category"
                  error={errorFor('category')}
                  value={draft.category ?? ''}
                  onChange={(e) => chooseCategory(e.target.value)}
                >
                  <option value="">Choose a category…</option>
                  {ORGANIZER_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </SelectField>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2 className={styles.stepTitle}>Event details</h2>
                <TextField
                  label="Title"
                  name="title"
                  error={errorFor('title')}
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) => patch({ title: e.target.value })}
                />
                <TextArea
                  label="Description"
                  name="description"
                  error={errorFor('description')}
                  value={draft.description}
                  maxLength={5000}
                  onChange={(e) => patch({ description: e.target.value })}
                />
                <div className={styles.twoCol}>
                  <TextField
                    label="Starts (WAT)"
                    name="startsAt"
                    error={errorFor('startsAt')}
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => patch({ startsAt: e.target.value })}
                  />
                  <TextField
                    label="Ends (WAT)"
                    name="endsAt"
                    error={errorFor('endsAt')}
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(e) => patch({ endsAt: e.target.value })}
                  />
                </div>
                <TextField
                  label="Venue name"
                  name="venueName"
                  error={errorFor('venueName')}
                  value={draft.venueName}
                  onChange={(e) => patch({ venueName: e.target.value })}
                />
                <TextField
                  label="Venue directions"
                  hint="Optional. Help guests find the right gate."
                  value={draft.venueDetail}
                  onChange={(e) => patch({ venueDetail: e.target.value })}
                />
                <TextField
                  label="Capacity"
                  name="capacity"
                  error={errorFor('capacity')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  hint="Leave empty for no limit."
                  value={draft.capacity ?? ''}
                  onChange={(e) =>
                    patch({ capacity: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
                <ToggleRow
                  label="UI students only"
                  hint="Only verified University of Ibadan students can RSVP."
                  checked={draft.studentsOnly}
                  onChange={(e) => {
                    studentsOnlyTouched.current = true;
                    patch({ studentsOnly: e.target.checked });
                  }}
                />
                <ToggleRow
                  label="Waitlist when full"
                  hint={
                    draft.capacity === null
                      ? 'Set a capacity to use a waitlist.'
                      : 'Promote waitlisted guests automatically when spots open.'
                  }
                  checked={draft.capacity !== null && draft.waitlistEnabled}
                  disabled={draft.capacity === null}
                  onChange={(e) => patch({ waitlistEnabled: e.target.checked })}
                />
                <div>
                  <label className={styles.stepSubtitle} htmlFor="event-cover">
                    Cover image
                  </label>
                  <input
                    id="event-cover"
                    name="cover"
                    aria-invalid={errorFor('cover') ? true : undefined}
                    aria-describedby={errorFor('cover') ? 'event-cover-error' : undefined}
                    type="file"
                    accept={COVER_TYPES.join(',')}
                    onChange={(e) => chooseCover(e.target.files?.[0])}
                  />
                  <p className={styles.stepSubtitle}>JPEG, PNG or WebP up to 5 MB.</p>
                  {coverError ? (
                    <p role="alert" className={styles.stepSubtitle}>
                      {coverError}
                    </p>
                  ) : errorFor('cover') ? (
                    <p id="event-cover-error" role="alert" className={styles.fieldError}>
                      {errorFor('cover')}
                    </p>
                  ) : null}
                </div>
                <div className={styles.preview} aria-label="Event card preview">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="" className={styles.previewCover} />
                  ) : (
                    <div className={styles.previewCover} aria-hidden="true" />
                  )}
                  {draft.category ? <CategoryPill category={draft.category} /> : null}
                  <p className={styles.previewTitle}>{draft.title || 'Your event title'}</p>
                  <p className={styles.stepSubtitle}>
                    {when ? `${when.compactLabel} WAT` : 'Date and time'}
                    {draft.venueName ? ` · ${draft.venueName}` : ''}
                  </p>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2 className={styles.stepTitle}>
                  {TEMPLATE_LABELS[draft.template].label} details
                </h2>

                {blocks.includes('lineup') ? (
                  <section className={styles.stepSection} aria-label="Lineup">
                    <h2 className={styles.blockHeading}>Lineup</h2>
                    {draft.lineup.map((slot, index) => (
                      <div key={slot.id} className={styles.repeaterRow}>
                        <TextField
                          label={`Performer ${index + 1}`}
                          value={slot.performerName}
                          onChange={(e) =>
                            patch({
                              lineup: draft.lineup.map((s) =>
                                s.id === slot.id ? { ...s, performerName: e.target.value } : s,
                              ),
                            })
                          }
                        />
                        <div className={styles.twoCol}>
                          <TextField
                            label={`Role ${index + 1}`}
                            required={!DEMO_MODE}
                            value={slot.role}
                            onChange={(e) =>
                              patch({
                                lineup: draft.lineup.map((s) =>
                                  s.id === slot.id ? { ...s, role: e.target.value } : s,
                                ),
                              })
                            }
                          />
                          <TextField
                            label={`Set time ${index + 1}`}
                            placeholder="9:30 PM"
                            value={slot.setTime}
                            onChange={(e) =>
                              patch({
                                lineup: draft.lineup.map((s) =>
                                  s.id === slot.id ? { ...s, setTime: e.target.value } : s,
                                ),
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            patch({ lineup: draft.lineup.filter((s) => s.id !== slot.id) })
                          }
                        >
                          Remove performer {index + 1}
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patch({
                          lineup: [
                            ...draft.lineup,
                            { id: nextRowId('lineup'), performerName: '', role: '', setTime: '' },
                          ],
                        })
                      }
                    >
                      Add performer
                    </Button>
                  </section>
                ) : null}

                {blocks.includes('showtimes') ? (
                  <section className={styles.stepSection} aria-label="Showtimes">
                    <h2 className={styles.blockHeading}>Showtimes</h2>
                    {draft.showtimes.map((show, index) => (
                      <div key={show.id} className={styles.repeaterRow}>
                        <div className={styles.twoCol}>
                          <TextField
                            label={`Showtime label ${index + 1}`}
                            placeholder="Opening night"
                            value={show.label}
                            onChange={(e) =>
                              patch({
                                showtimes: draft.showtimes.map((s) =>
                                  s.id === show.id ? { ...s, label: e.target.value } : s,
                                ),
                              })
                            }
                          />
                          <TextField
                            label={`Showtime starts ${index + 1}`}
                            type="datetime-local"
                            value={show.startsAt}
                            onChange={(e) =>
                              patch({
                                showtimes: draft.showtimes.map((s) =>
                                  s.id === show.id ? { ...s, startsAt: e.target.value } : s,
                                ),
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            patch({ showtimes: draft.showtimes.filter((s) => s.id !== show.id) })
                          }
                        >
                          Remove showtime {index + 1}
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patch({
                          showtimes: [
                            ...draft.showtimes,
                            { id: nextRowId('show'), label: '', startsAt: '' },
                          ],
                        })
                      }
                    >
                      Add showtime
                    </Button>
                  </section>
                ) : null}

                {blocks.includes('matchTeams') ? (
                  <section className={styles.stepSection} aria-label="Match">
                    <h2 className={styles.blockHeading}>Teams</h2>
                    <div className={styles.twoCol}>
                      <TextField
                        label="Home team"
                        value={draft.homeTeam}
                        onChange={(e) => patch({ homeTeam: e.target.value })}
                      />
                      <TextField
                        label="Away team"
                        value={draft.awayTeam}
                        onChange={(e) => patch({ awayTeam: e.target.value })}
                      />
                    </div>
                  </section>
                ) : null}

                {blocks.includes('dressCode') ? (
                  <TextField
                    label="Dress code"
                    hint="Optional."
                    value={draft.dressCode}
                    onChange={(e) => patch({ dressCode: e.target.value })}
                  />
                ) : null}

                {blocks.includes('doorPolicy') ? (
                  <TextArea
                    label="Door policy"
                    hint="Optional. Doors, ID checks, bag rules."
                    value={draft.doorPolicy}
                    onChange={(e) => patch({ doorPolicy: e.target.value })}
                  />
                ) : null}

                {blocks.includes('afterParty') ? (
                  <section className={styles.stepSection} aria-label="After-party">
                    <ToggleRow
                      label="This is the official after-party of another event"
                      checked={draft.linkAfterParty}
                      disabled={parentOptions.length === 0}
                      hint={
                        parentOptions.length === 0
                          ? 'Publish the main event first, then link its after-party.'
                          : undefined
                      }
                      onChange={(e) =>
                        patch({
                          linkAfterParty: e.target.checked,
                          ...(e.target.checked ? {} : { parentEventId: null }),
                        })
                      }
                    />
                    {draft.linkAfterParty ? (
                      <>
                        <SelectField
                          label="Main event"
                          value={draft.parentEventId ?? ''}
                          onChange={(e) => patch({ parentEventId: e.target.value || null })}
                        >
                          <option value="">Choose the main event…</option>
                          {parentOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title}
                            </option>
                          ))}
                        </SelectField>
                        <SelectField
                          label="Who can RSVP"
                          value={draft.afterPartyAccessRule}
                          onChange={(e) =>
                            patch({ afterPartyAccessRule: e.target.value as AfterPartyAccessRule })
                          }
                        >
                          {ACCESS_RULES.map((rule) => (
                            <option key={rule.value} value={rule.value}>
                              {rule.label}
                            </option>
                          ))}
                        </SelectField>
                      </>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : null}
          </AnimatedStep>
        </AnimatePresence>

        {step === 3 && !canPublish ? (
          <p id="publish-locked" className={styles.notice}>
            Publishing unlocks once your club is verified. Save a draft in the meantime.
          </p>
        ) : null}

        <div className={styles.actions}>
          {step > 1 ? (
            <Button variant="secondary" onClick={goBack}>
              Back
            </Button>
          ) : null}
          <div className={styles.actionsEnd}>
            <Button variant="ghost" isLoading={busy === 'draft'} onClick={() => run('draft')}>
              Save Draft
            </Button>
            {step < 3 ? (
              <Button onClick={goNext}>Continue</Button>
            ) : (
              <Button
                isLoading={busy === 'publish'}
                disabled={!canPublish}
                aria-describedby={!canPublish ? 'publish-locked' : undefined}
                onClick={() => run('publish')}
              >
                Publish Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
