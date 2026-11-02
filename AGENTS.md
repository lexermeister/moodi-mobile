# Moodi repository conventions

The Expo application lives in `apps/mobile`. Read `apps/mobile/AGENTS.md` before changing mobile code; its SDK-version and Expo documentation rules are mandatory.

## Commands

Run mobile commands from `apps/mobile`:

```bash
npm ci
npm run typecheck
npm run lint
npm run doctor
npm run ios
```

Use a Node version supported by the installed Expo SDK (Node 24.3 or newer is recommended). Use `npx expo install <package>` for Expo/React Native dependencies and commit `apps/mobile/package-lock.json` whenever dependencies change.

## Conventions

- Keep Expo Router route files in `apps/mobile/src/app` and feature code outside that directory.
- Keep UI, native lifecycle logic, and persistence in separate small modules.
- Configure native behavior in Expo app configuration and config plugins. Do not commit or manually edit generated `ios` or `android` projects.
- Treat microphone permission denial, audio interruption, and foreground/background transitions as normal states.
- Store user recordings in app document storage. Do not commit recordings, local environment files, dependency folders, generated native projects, or build output.
- Run typecheck, lint, and Expo diagnostics before handing off mobile changes.
