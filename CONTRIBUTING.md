# Contributing to NPTEL Hub

Thanks for contributing.

This document reflects the current product direction of the repo so new contributors do not accidentally reintroduce old flows.

## Product assumptions to preserve

- guest access is automatic and browser-specific
- Google sign-in is the real write-enabled login flow
- guest/demo users can browse and read, but write actions are restricted
- week discussions and common discussions are intentionally simple
- quick chat is temporary and more restricted than the discussion board

## Before you start

Read:

1. [README.md](README.md)
2. [QUICK_START.md](QUICK_START.md)
3. [SETUP.md](SETUP.md)

## Setup

```bash
cd server
npm install

cd ../client
npm install
```

Create:

- `server/.env` from `server/.env.example`
- `client/.env.local` from `client/.env.local.example`

## Branching

- branch from `main`
- use a focused branch name such as:
  - `feat/google-auth-copy`
  - `fix/week-discussion-refresh`
  - `docs/update-readme`

## Commit style

Conventional commits are preferred:

```text
feat: add global active-user badge to navbar
fix: restore week discussion fetch after posting
docs: rewrite setup and auth documentation
```

## Areas where accuracy matters

Please be extra careful when changing:

- auth and guest bootstrap behavior
- Google sign-in setup
- chat moderation rules
- PDF material proxy/viewer logic
- public/anonymous username behavior
- any docs describing setup or authentication

## Expected local checks

### Frontend

```bash
cd client
npm run build
```

If you touched lint-sensitive areas, also run:

```bash
npm run lint
```

### Backend

Run at least a basic module-load sanity check when changing core server files:

```bash
cd server
node -e "require('./src/controllers/authController'); console.log('auth ok')"
node -e "require('./src/controllers/yearInstanceController'); console.log('weeks ok')"
node -e "require('./src/sockets/chat'); console.log('socket ok')"
```

## Pull request checklist

- the feature or fix matches the current product direction
- setup/auth docs are still accurate after the change
- env examples are updated if new variables were introduced
- frontend build passes
- backend sanity checks pass
- screenshots are included for UI changes when helpful

## Bug reports

Please include:

- what page/route you were on
- whether you were guest, demo, or Google-authenticated
- exact steps to reproduce
- actual result
- expected result
- screenshots or console/network errors if available

## UI guidance

For this repo, contributors should generally preserve:

- simple, readable layouts
- existing Tailwind conventions
- consistent Lucide icon usage
- low-friction browsing for guest users
- obvious sign-in prompts for write-restricted actions

## Docs policy

If your change alters behavior, also update the relevant docs:

- `README.md` for repo-level behavior
- `QUICK_START.md` and `SETUP.md` for run/setup changes
- env examples for any new config
- `PROJECT_SUMMARY.md` for major structural changes

## License

By contributing, you agree that your contributions are released under the MIT License used by this repository.
