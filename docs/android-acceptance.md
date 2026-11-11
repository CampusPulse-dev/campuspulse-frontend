# Physical Android Chrome acceptance [S6-01]

Status: **pending handoff**. Emulated WebKit/Chromium and fake-camera video do not count as physical acceptance. Use a secure staging origin, synthetic accounts, synthetic tickets and a separate display showing QR codes. Staging access is currently unavailable.

Record tester/date, phone model, Android and Chrome versions, frontend/backend full SHAs, staging origins, connection conditions, and pass/fail plus evidence for each step. Keep account credentials and student identity images out of screenshots and attachments.

1. Open the event in an ordinary signed-out Chrome tab. Confirm title, cover, venue and RSVP access without installation. Sign up/sign in and reserve a synthetic ticket; open its QR pass.
2. Open the granted door event. Confirm QR Scanner and Manual Check-In are peer tabs. Download its roster online and confirm readiness.
3. Deny camera permission. Confirm the actionable permission message and working manual tab. Grant permission through Chrome site settings and restart the camera. Record rear-camera selection and preview behavior.
4. Scan displayed server-issued valid, duplicate, tampered and wrong-event QR codes. Confirm green valid feedback, duplicate warning, invalid/wrong-event denial, correct attendee and no extra check-in. Record vibration support/results; haptics must not be the sole signal.
5. Repeat at different distances, screen brightness and angles, in glare and low light. Record focus time and any scanner stalls. Verify feedback within 500ms of token decode (capture slow-motion video if needed).
6. Enable airplane mode. Scan an unused valid pass and manually check in another attendee. Confirm queued count. Fully reload Chrome while offline; verify roster, scans, outbox and manual tab remain available. Reload the attendee pass offline and confirm its QR renders.
7. Reconnect. Confirm each queued record is replayed once and server totals reconcile. Reload and confirm no second increment. Repeat a duplicate from a second door device and confirm reconciliation.
8. Sign out. Confirm cached tickets, scanner roster, private document view and pending account data are inaccessible to the next signed-in user. Revoke camera permission and confirm graceful denial again.

Attach results to the S6 release report. A failed or unexecuted step remains an open release gate. The responsible owner records acceptance; automation must not mark this checklist passed.
