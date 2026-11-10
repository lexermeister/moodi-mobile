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
