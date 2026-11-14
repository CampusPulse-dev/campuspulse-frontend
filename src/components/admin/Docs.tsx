import React from 'react';
import { PageHeader } from './AdminBits';
import styles from './Admin.module.css';

/** The rules a reviewer needs in front of them. Mirrors docs/01 (roles, NDPA) and docs/05 (flows). */
export function Docs() {
  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Reference" title="Reviewer guide">
        How the queues work, and the rules that are not optional.
      </PageHeader>

      <section className={styles.section}>
        <h2>Working a queue</h2>
        <ol>
          <li>Queues are oldest first. Start at the top.</li>
          <li>
            Claim a request before you review it. The claim holds it for you for 15 minutes; extend
            it if you need longer. If it lapses, someone else can take it.
          </li>
          <li>
            Decide: approve, request more information, or reject. Rejecting and requesting
            information both need a note, and the applicant reads that note, so write it for them.
          </li>
          <li>Decisions cannot be undone. If you are unsure, request information.</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>The 48-hour promise</h2>
        <p>
          Applicants are told to expect a decision within 48 hours. The bar at the top of every page
          shows the oldest request you can work; it turns red once that request is past 48 hours,
          and overdue rows are marked in the queue.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Student ID images (NDPA 2023)</h2>
        <ul>
          <li>Only a Super Admin can open the student ID queue or see an ID image.</li>
          <li>
            Every time you press View ID image, the view is recorded in the audit log against your
            account before the image loads.
          </li>
          <li>
            The image is shown with your name and the time across it. Do not screenshot, photograph
            or describe it anywhere outside this page.
          </li>
          <li>
            The image is deleted from storage the moment you decide, whatever the decision. It
            cannot be recovered; a rejected student uploads a new one.
          </li>
          <li>Never ask a student to send an ID by email, WhatsApp or any other channel.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Who can do what</h2>
        <ul>
          <li>
            <strong>Verifier</strong>: club and creator applications.
          </li>
          <li>
            <strong>Moderator</strong>: reports. Can unpublish an event, remove a story, suspend a
            reported user, or dismiss.
          </li>
          <li>
            <strong>Super Admin</strong>: everything above, plus student IDs, roles, suspensions,
            settings and the audit log.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Keyboard shortcuts in a verification queue</h2>
        <ul>
          <li>
            <kbd className={styles.kbd}>J</kbd> / <kbd className={styles.kbd}>K</kbd> next /
            previous request
          </li>
          <li>
            <kbd className={styles.kbd}>C</kbd> claim or extend
          </li>
          <li>
            <kbd className={styles.kbd}>A</kbd> approve · <kbd className={styles.kbd}>I</kbd>{' '}
            request info · <kbd className={styles.kbd}>R</kbd> reject (each still asks you to
            confirm)
          </li>
        </ul>
      </section>
    </div>
  );
}
