# Nerve - Web Client Development Guide

**Date:** 2026-04-02
**Part:** `web-client`

## Scope

This guide covers local development for the React/Vite frontend in `src/`.

## Prerequisites

- Node.js 22.x
- npm
- A running API at `/api` locally, either through `npm run dev:server` or `docker compose up -d db api`
- Environment values based on `.env.example`

## Environment Setup

Relevant client-side env:

- `VITE_API_BASE_URL` defaults to `/api`

Recommended setup:

```bash
npm ci
cp .env.example .env.local
```

You only need to change `VITE_API_BASE_URL` if the API is not being served from the same origin path.

## Run Locally

### Option 1: Separate client and server terminals

```bash
npm run dev:server
npm run dev
```

### Option 2: Containerized backend plus local frontend

```bash
docker compose up -d db api
npm run dev
```

Vite serves the SPA on port `8080` and proxies `/api` to `127.0.0.1:3001`.

## Build And Verification Commands

```bash
npm run build:client
npm run lint
npm test
npm preview
```

## Active Frontend Data Model

For new routed UI work, use:

- `useAuth()` for session and role/team information
- `useAppData()` for shared application data and mutations
- `src/lib/api.ts` for low-level request behavior when needed

Avoid introducing new feature code that depends on `src/lib/db.ts` unless you are explicitly reviving or removing the older unrouted localStorage pages.

## Important Files

- `src/main.tsx` - client bootstrap
- `src/App.tsx` - provider stack and active route map
- `src/components/AppLayout.tsx` - authenticated app shell
- `src/components/AppSidebar.tsx` - navigation by role/team
- `src/components/RoleGuard.tsx` - route access control
- `src/hooks/useAuth.tsx` - session restore and login/logout
- `src/hooks/useAppData.tsx` - bootstrap data loading and mutation helpers
- `src/lib/api.ts` - REST client

## Common Change Workflows

### Add a new routed page

1. Create the page in `src/pages/` or the appropriate team subfolder.
2. Add the route in `src/App.tsx`.
3. Update `AppSidebar.tsx` if navigation should expose it.
4. Wrap it in `RoleGuard` if access should be restricted.

### Add a new API-backed client action

1. Add or update the endpoint in `src/lib/api.ts`.
2. Expose the action in `useAppData.tsx` if it belongs to shared app state.
3. Update the consuming page to use the provider instead of ad hoc fetch logic.

### Add or update UI primitives

1. Check `src/components/ui/` first for an existing primitive.
2. Reuse the wrapper if possible rather than embedding raw Radix logic in page files.
3. Keep styling aligned with the existing Tailwind utility and `hub-*` class patterns.

## Known Frontend Constraints

- Some legacy dashboard files still use `src/lib/db.ts`, but they are not part of the active route map.
- `QueryClientProvider` is installed, but React Query hooks are not yet used.
- AI pages currently show fallback behavior when the retained cloud AI path is disconnected.
- Test coverage is minimal; most frontend confidence currently comes from manual review.

## Recommended Checks Before Merging UI Work

```bash
npm run lint
npm test
npm run build:client
```

Then manually verify the affected routes in the browser, especially role-based redirects and any `/api` mutation flow.

---

_Generated using BMAD Method `document-project` workflow_
