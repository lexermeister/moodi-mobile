# Moodi mobile

The app records and stores verified M4A files locally. When the user taps **Generate session
insights**, it uploads the recording, requests a client/therapist transcript, generates structured
insights, and keeps the transcript available as secondary detail. Completed stages are persisted so
a retry does not repeat successful work. Generated insights remain an immutable draft; the user can
edit or remove visible bullets and save a separate reviewed version that persists locally and on the
backend.

## Backend configuration

Copy the example environment file in this directory:

```bash
cp .env.example .env.local
```

For the iOS Simulator with the backend running on the same Mac:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

This is a public client-side URL, not a secret. Never put `OPENAI_API_KEY` or any other private key
in an `EXPO_PUBLIC_` variable.

This directory contains the Expo SDK 58 mobile application. See the repository [README](../../README.md) for setup, development-build commands, manual simulator checks, and physical-device coverage.

Run checks from this directory:

```bash
npm ci
npm run typecheck
npm run lint
npm run doctor
```

## Journey and Moodi redesign (increments 1–2)

The app opens on Moodi (Today). Journey lists recordings saved on this device, newest session
first, with summary, transcript, playback, export, and processing retry available in session details.
The bottom-right Moodi panel shares a single recording library across both tabs. Minimizing the
panel or switching tabs does not unmount the recorder. The existing stop-on-background behavior
still applies. Summary generation remains an explicit action in session details for this increment.
Existing actions remain accessible from Today; the check-in redesign is a later increment.

No backend schema or local recording format changes are required. No sample sessions are inserted
into the real recording library. The old `/sessions` route redirects to Journey.

Run the focused presentation checks with Node 24.3 or newer:

```bash
node --test tests/sessionPresentation.test.mjs
```

Manual acceptance checks:

1. Cold-launch the app: Moodi is selected and only Journey and Moodi appear in the tab bar.
2. Open and minimize the corner panel on either tab; tab controls remain usable.
3. Record, switch tabs, and reopen the panel: elapsed recording time continues. Stop and verify
   the session appears in Journey. Backgrounding retains the existing explicit-stop behavior.
4. Relaunch: existing sessions, summaries, and review state are retained. Open a session, expand
   its transcript, play audio, and navigate back.
5. Check empty, processing, failed/retry, and reviewed sessions; no fake history should appear.
6. Check panel scrolling and session details with larger text and on a small iPhone.
# Record mood check-in (Stage 3)

Activate a Record mood action in Journey, then open Moodi → Today → To do.
The Record mood card opens the check-in; an unfinished draft shows Resume check-in.
The flow covers mood, selected additional measurements, feelings, intensity, context,
and review. Optional questions can be skipped. Scores stay unanswered until selected;
zero is a valid answer. Review rows allow returning to the relevant question.

Answers autosave to the backend as drafts. Save & close waits for persistence;
reopening resumes the latest draft with its original entry date and current step.
Confirmation saves the combined entry, and the action remains available for future
check-ins. Draft writes are serialized, and confirmation retries reuse the entry ID.
Failed saves retain answers in the open wizard and provide a retry action.

Run `node --test tests/*.test.mjs`, `npm run typecheck`, `npm run lint`, and
`npm run doctor` for verification. The full Mood entries list and Journey completion
history are subsequent work. Existing label-based legacy actions keep their earlier
entry screen; numeric Record mood actions use the new wizard.

## Automatic session review

Stopping a recording finalizes the local M4A, closes the Moodi panel, and opens that
session in Journey. Upload, transcription, and session-insight generation start
automatically and the open review screen follows their persisted status. A recording
stopped by an interruption or while backgrounding opens when the app becomes active.

The automatic pipeline is guarded per local recording ID, so overlapping recorder
events do not start duplicate requests. Interrupted processing is marked failed when
the app next loads. The review screen offers Retry processing only after a failure;
ordinary sessions no longer require a Generate summary action.
