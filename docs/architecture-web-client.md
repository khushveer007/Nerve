# Nerve - Web Client Architecture

**Date:** 2026-04-02
**Part:** `web-client`
**Root:** `src/`
**Project Type:** Web frontend

## Executive Summary

The web client is a React 18 single-page app bootstrapped with Vite. `src/App.tsx` defines the active route map, wraps the app with auth and data providers, and mounts a role-gated shell through `AppLayout` and `RoleGuard`. The active routed experience is API-backed and uses cookie-authenticated requests against `/api`.

The repo also contains older dashboard files that read directly from `src/lib/db.ts`, a browser `localStorage` helper with seed data. Those files are valuable historical context, but they are not part of the current route tree in `src/App.tsx`. Future work should treat them as legacy references unless they are intentionally being revived.

## Technology Stack

| Category | Technology | Notes |
| --- | --- | --- |
| Language | TypeScript | Used throughout the SPA |
| Runtime | React 18 | Mounted from `src/main.tsx` |
| Routing | React Router | All active routes declared in `src/App.tsx` |
| Data loading | Custom fetch + context providers | `useAuth()` and `useAppData()` manage session restore and bootstrap data |
| Styling | Tailwind CSS | Shared utility classes with component wrappers |
| UI primitives | Radix UI + shadcn-style wrappers | 49 reusable files in `src/components/ui/` |
| Icons | Lucide React | Navigation, stats, and action icons |
| Charts | Recharts | Used by dashboard views |
| Tooling | Vite, ESLint, Vitest, Playwright | Dev server, linting, and limited test scaffolding |

## Architecture Pattern

The client follows a provider-driven SPA pattern:

1. `src/main.tsx` mounts `App.tsx`.
2. `App.tsx` installs global providers (`QueryClientProvider`, `AuthProvider`, `AppDataProvider`, tooltip and toast systems).
3. `BrowserRouter` owns navigation and route selection.
4. `AppLayout` enforces authenticated shell behavior.
5. `RoleGuard` enforces route access by role and optionally by team.
6. Feature pages consume auth and app data through hooks and local component state.

### Provider Stack

- **`AuthProvider`** restores the current session via `GET /api/auth/me`, exposes `signIn`, `signOut`, and computes dashboard redirects.
- **`AppDataProvider`** calls `GET /api/bootstrap` after auth succeeds, then exposes in-memory collections and mutation helpers for entries, users, teams, and branding rows.
- **`QueryClientProvider`** is present, but React Query hooks are not currently used elsewhere in the repo.

### State Model

- **Auth state:** `user`, `role`, `team`, and `loading` live in `useAuth.tsx`.
- **Shared app data:** entries, users, teams, branding rows, and mutation helpers live in `useAppData.tsx`.
- **Page-local UI state:** filters, dialog state, loading flags, and form drafts use `useState`, `useMemo`, and `useCallback`.
- **Legacy local data:** `src/lib/db.ts` still contains seeded browser-side models for entries, users, teams, and branding rows. Those are used only by older unrouted screens.

## Active Route Architecture

### Public Route

- `/login` -> `LoginPage`

### Shared Authenticated Shell

- `AppLayout` wraps all authenticated pages and displays the sidebar plus page outlet.

### Active Routed Feature Areas

- **Super admin:** `/super-admin/dashboard`, `/super-admin/users`, `/super-admin/settings`
- **Branding team:** `/branding/dashboard`, `/branding/sub-admin`, `/branding/user`, `/branding/team`
- **Content team:** `/content/dashboard`, `/content/sub-admin`, `/content/user`, `/content/team`
- **Shared tools:** `/browse`, `/add`, `/team`, `/admin/export`, `/ai/query`, `/ai/newsletter`

### Legacy Unrouted Files

These files still exist in `src/pages/` but are not imported by the active router:

- `Dashboard.tsx`
- `SubAdminDashboard.tsx`
- `UserDashboard.tsx`
- `AdminUsers.tsx`
- `SubAdminPanel.tsx`

All of the above read from `src/lib/db.ts`, so they should not be mistaken for the active source of truth.

## Component Overview

### App Shell

- **`AppLayout.tsx`**: Redirects unauthenticated users to `/login`, shows global loading/error state, and renders the sidebar + outlet.
- **`AppSidebar.tsx`**: Builds navigation from the `${role}:${team}` key and controls the sign-out action.
- **`RoleGuard.tsx`**: Redirects users to their role/team dashboard when role or team rules fail.

### Data and Auth Layer

- **`useAuth.tsx`**: Session restore, login/logout, and dashboard routing logic.
- **`useAppData.tsx`**: Bootstrap fetch, optimistic local list updates, and API-backed CRUD helpers.
- **`src/lib/api.ts`**: Low-level cookie-authenticated fetch wrapper against `/api`.
- **`src/lib/constants.ts`**: Roles, teams, departments, entry types, and priorities.

### Feature Pages

- **Operational CRUD:** `Browse.tsx`, `AddEntry.tsx`, `TeamPanel.tsx`, `SuperAdminUsers.tsx`
- **AI tools:** `AIQuery.tsx`, `AINewsletter.tsx`
- **Admin settings and dashboards:** `SuperAdminDashboard.tsx`, `SuperAdminSettings.tsx`, `branding/*`, `content/*`
- **Support pages:** `Login.tsx`, `NotFound.tsx`

### UI Primitive Layer

`src/components/ui/` contains reusable wrappers for forms, dialogs, menus, tables, tabs, drawers, toasts, charts, and other Radix/Tailwind building blocks. This is the shared design-system surface future UI work should reuse first.

## Data Flow

### Active Routed Flow

1. Browser loads the SPA.
2. `AuthProvider` calls `api.getMe()` to restore the session.
3. If a user is present, `AppDataProvider` calls `api.bootstrap()` to fetch entries, users, teams, and branding rows.
4. Routed pages read from provider state and call mutation helpers.
5. Mutation helpers call REST endpoints, then update provider state in memory.

### Legacy Repo Flow

Older unrouted files call `db.entries.getAll()` and `db.users.getAll()` from `src/lib/db.ts`. That code persists to `localStorage` keys such as `pu_entries` and `pu_users`, but it is not part of the current routed product path.

## Integration Boundaries

- **API boundary:** `src/lib/api.ts` talks to `/api` using `credentials: "include"`.
- **Dev proxy:** `vite.config.ts` forwards `/api` to `http://127.0.0.1:3001`.
- **Retained Supabase boundary:** `src/integrations/supabase/client.ts` exports `null`, so active pages should not depend on Supabase client behavior.
- **Static assets:** `public/` provides the favicon, placeholder image, and robots file.

## Development Workflow

- Start the client with `npm run dev`.
- Start the server separately with `npm run dev:server` or via `docker compose up -d db api`.
- Prefer new features to use `useAppData()` and the REST API instead of adding more `src/lib/db.ts` coupling.
- When changing navigation or access control, update `App.tsx`, `RoleGuard.tsx`, and `AppSidebar.tsx` together.

## Deployment Architecture

- `npm run build:client` produces the static frontend in `dist/`.
- `deploy/scripts/deploy.sh` syncs `dist/` to a timestamped release directory under `/srv/nerve/releases/`.
- `nginx/nerve.conf` serves the SPA and rewrites unknown paths to `index.html`, which preserves client-side routing.
- Production API requests stay same-origin under `/api`.

## Testing Strategy

- Client test scaffolding exists in `src/test/`, but only a placeholder `example.test.ts` is present today.
- `npm run lint` validates TS/React lint rules across client and server files.
- No meaningful page-level frontend integration tests currently exist in the repo.

## Risks And Constraints

- Legacy unrouted localStorage pages can confuse future changes if they are mistaken for active product code.
- React Query is installed but unused, which may mislead contributors about the data model.
- The retained Supabase types and migrations do not exactly match the active Express/PostgreSQL role model.
- AI screens currently present fallback behavior when the backend AI path is unavailable.

---

_Generated using BMAD Method `document-project` workflow_
