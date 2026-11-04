# Moodi mobile

The app records and stores verified M4A files locally, then uploads them to the configured Moodi
backend and displays the returned `gpt-transcribe` transcript.

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
