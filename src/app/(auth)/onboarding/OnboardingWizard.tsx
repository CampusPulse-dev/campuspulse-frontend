'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fadeInUp, springBouncy } from '@/lib/motion';
import { SEED_ORGANIZERS, UI_FACULTIES, UI_HALLS, VIBE_OPTIONS } from '@/lib/campus-data';
import type { OutingRhythm, PersonaProfile } from '@/lib/auth-context';
import styles from '../Auth.module.css';

export interface PersonaBadgeInfo {
  title: 'Night Owl' | 'Culture Vulture' | 'First-Row Fan' | 'Campus Connector';
  tagline: string;
  emoji: string;
}

export function derivePersonaBadge(input: {
  vibes: string[];
  rhythm: OutingRhythm;
}): PersonaBadgeInfo {
  const hasNightlife = input.vibes.some((v) => v.includes('Parties') || v.includes('Concerts'));
  const hasCulture = input.vibes.some((v) => v.includes('Theatre') || v.includes('Creators'));
  const hasSports = input.vibes.some((v) => v.includes('Sports'));

  if (hasNightlife && (input.rhythm === 'WEEKENDS' || input.rhythm === 'BOTH')) {
    return {
      title: 'Night Owl',
      tagline: 'First on the SUB Field dancefloor and locked in for every official after-party.',
      emoji: '🦉',
    };
  }
  if (hasCulture) {
    return {
      title: 'Culture Vulture',
      tagline: 'Front row at Wole Soyinka Theatre, acoustic nights, and creative showcases.',
      emoji: '🎭',
    };
  }
  if (hasSports) {
    return {
      title: 'First-Row Fan',
      tagline: 'Never misses an Inter-Hall kickoff or floodlight derby at the UI New Stadium.',
      emoji: '🏆',
    };
  }
  return {
    title: 'Campus Connector',
    tagline: 'From Trenchard Hall summits to hall dinners—you know everyone on campus.',
    emoji: '⚡',
  };
}

export interface OnboardingWizardProps {
  onComplete: (profile: PersonaProfile) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [vibes, setVibes] = useState<string[]>(['Concerts & live music']);
  const [hall, setHall] = useState<string>(UI_HALLS[0]);
  const [faculty, setFaculty] = useState<string>(UI_FACULTIES[0]);
  const [level, setLevel] = useState<string>('300L');
  const [followedClubIds, setFollowedClubIds] = useState<string[]>([
    SEED_ORGANIZERS[0]!.id,
    SEED_ORGANIZERS[2]!.id,
  ]);
  const [rhythm, setRhythm] = useState<OutingRhythm>('WEEKENDS');
  const [freeEventsOnly, setFreeEventsOnly] = useState<boolean>(true);

  const badge = derivePersonaBadge({ vibes, rhythm });

  function toggleVibe(vibe: string) {
    setVibes((prev) => {
      if (prev.includes(vibe)) return prev.filter((item) => item !== vibe);
      if (prev.length >= 5) return prev;
      return [...prev, vibe];
    });
  }

  function toggleClub(clubId: string) {
    setFollowedClubIds((prev) =>
      prev.includes(clubId) ? prev.filter((id) => id !== clubId) : [...prev, clubId],
    );
  }

  function handleSkip() {
    onComplete({
      skipped: true,
      vibes,
      hall,
      faculty,
      level,
      rhythm,
      freeEventsOnly,
      personaBadge: badge.title,
      followedClubIds,
    });
  }

  function handleFinish() {
    onComplete({
      skipped: false,
      vibes,
      hall,
      faculty,
      level,
      rhythm,
      freeEventsOnly,
      personaBadge: badge.title,
      followedClubIds,
    });
  }

  return (
    <div className={styles.onboardingCard}>
      <div className={styles.onboardingTopBar}>
        <div className={styles.stepDots} aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((idx) => (
            <span
              key={idx}
              className={`${styles.stepDot} ${idx <= step ? styles.stepDotActive : ''}`}
            />
          ))}
        </div>
        <button type="button" className={styles.skipButton} onClick={handleSkip}>
          Skip →
        </button>
      </div>

      <AnimatePresence>
        {step === 1 ? (
          <motion.section
            key="step-1"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={styles.stepSection}
          >
            <Badge variant="verified">Step 1 of 4 · &lt;30s Setup</Badge>
            <h1 className={styles.stepTitle}>What are you into?</h1>
            <p className={styles.stepSubtitle}>
              Pick up to 5 vibes so your &ldquo;For You&rdquo; row and Tonight chips match your
              energy.
            </p>

            <div className={styles.chipGrid}>
              {VIBE_OPTIONS.map((vibe) => {
                const selected = vibes.includes(vibe);
                return (
                  <button
                    key={vibe}
                    type="button"
                    aria-pressed={selected}
                    className={`${styles.vibeChip} ${selected ? styles.vibeChipActive : ''}`}
                    onClick={() => toggleVibe(vibe)}
                  >
                    {vibe}
                  </button>
                );
              })}
            </div>

            <div className={styles.stepActions}>
              <Button fullWidth size="lg" onClick={() => setStep(2)}>
                Continue to Cohort →
              </Button>
            </div>
          </motion.section>
        ) : null}

        {step === 2 ? (
          <motion.section
            key="step-2"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={styles.stepSection}
          >
            <Badge variant="verified">Step 2 of 4 · University of Ibadan</Badge>
            <h1 className={styles.stepTitle}>Your Campus Cohort</h1>
            <p className={styles.stepSubtitle}>
              Used for Hall inter-match alerts and mutual friend suggestions—never shared publicly.
            </p>

            <div className={styles.fieldGrid}>
              <label className={styles.fieldLabel}>
                <span>Hall of Residence</span>
                <select
                  className={styles.selectInput}
                  value={hall}
                  onChange={(e) => setHall(e.target.value)}
                >
                  {UI_HALLS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                <span>Faculty</span>
                <select
                  className={styles.selectInput}
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                >
                  {UI_FACULTIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                <span>Level</span>
                <select
                  className={styles.selectInput}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  {['100L', '200L', '300L', '400L', '500L', '600L', 'PG'].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.clubSuggestBlock}>
              <span className={styles.smallHeading}>One-Tap Verified UI Clubs to Follow</span>
              <div className={styles.clubList}>
                {SEED_ORGANIZERS.map((org) => {
                  const following = followedClubIds.includes(org.id);
                  return (
                    <button
                      key={org.id}
                      type="button"
                      className={`${styles.clubChip} ${following ? styles.clubChipActive : ''}`}
                      onClick={() => toggleClub(org.id)}
                    >
                      <span>{org.name}</span>
                      <span>{following ? '✓ Following' : '+ Follow'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.stepActions}>
              <Button variant="secondary" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button fullWidth size="lg" onClick={() => setStep(3)}>
                Continue to Rhythm →
              </Button>
            </div>
          </motion.section>
        ) : null}

        {step === 3 ? (
          <motion.section
            key="step-3"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={styles.stepSection}
          >
            <Badge variant="verified">Step 3 of 4 · Your Rhythm</Badge>
            <h1 className={styles.stepTitle}>When do you usually go out?</h1>
            <p className={styles.stepSubtitle}>
              We&apos;ll time your event reminders and Tonight suggestions around your schedule.
            </p>

            <div className={styles.rhythmOptions}>
              {(
                [
                  {
                    id: 'WEEKNIGHTS',
                    label: 'Weeknights',
                    desc: 'Talks, theatre & chill evenings',
                  },
                  {
                    id: 'WEEKENDS',
                    label: 'Weekends',
                    desc: 'Friday concerts, hall nights & finals',
                  },
                  { id: 'BOTH', label: 'Both', desc: 'Show me everything happening on campus' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={rhythm === item.id}
                  className={`${styles.rhythmCard} ${rhythm === item.id ? styles.rhythmCardActive : ''}`}
                  onClick={() => setRhythm(item.id)}
                >
                  <span className={styles.rhythmLabel}>{item.label}</span>
                  <span className={styles.rhythmDesc}>{item.desc}</span>
                </button>
              ))}
            </div>

            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={freeEventsOnly}
                onChange={(e) => setFreeEventsOnly(e.target.checked)}
              />
              <span>Prioritize free RSVP events in my feed</span>
            </label>

            <div className={styles.stepActions}>
              <Button variant="secondary" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button fullWidth size="lg" onClick={() => setStep(4)}>
                Reveal My Persona ✨
              </Button>
            </div>
          </motion.section>
        ) : null}

        {step === 4 ? (
          <motion.section
            key="step-4"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={styles.stepSection}
          >
            <motion.div
              className={styles.personaRevealCard}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springBouncy}
            >
              <span className={styles.personaEmoji} aria-hidden="true">
                {badge.emoji}
              </span>
              <Badge variant="verified">Your CampusPulse Persona</Badge>
              <h1 className={styles.personaTitle}>{badge.title}</h1>
              <p className={styles.personaTagline}>{badge.tagline}</p>
              <div className={styles.personaMetaRow}>
                <span>🏛️ {hall}</span>
                <span>🎓 {faculty}</span>
                <span>📚 {level}</span>
              </div>
            </motion.div>

            <div className={styles.stepActions}>
              <Button fullWidth size="lg" onClick={handleFinish}>
                Jump into Feed →
              </Button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
