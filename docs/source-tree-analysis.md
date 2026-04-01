# Nerve - Source Tree Analysis

**Date:** 2026-04-02

## Overview

Nerve is organized as a single repository with two active runtime parts and one retained cloud asset area. The active app lives in `src/` and `server/`, while `supabase/` documents a dormant but still relevant cloud architecture. Deployment automation sits alongside the application code in `deploy/`, `nginx/`, and root-level container files.

## Multi-Part Structure

This project is organized into two active parts plus supporting assets:

- **Web Client** (`src/`): React SPA and shared UI system
- **API Server** (`server/`): Express API, PostgreSQL bootstrap, session auth
- **Supporting Assets** (`supabase/`, `deploy/`, `nginx/`): retained cloud path and deployment tooling

## Complete Directory Structure

```text
Nerve/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── NavLink.tsx
│   │   ├── RoleGuard.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   ├── useAppData.tsx
│   │   └── use-mobile.tsx
│   ├── integrations/
│   │   └── supabase/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── app-types.ts
│   │   ├── constants.ts
│   │   ├── db.ts
│   │   ├── error-utils.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── branding/
│   │   ├── content/
│   │   └── *.tsx
│   ├── test/
│   └── vite-env.d.ts
├── server/
│   ├── config.ts
│   ├── connect-pg-simple.d.ts
│   ├── db.ts
│   ├── index.ts
│   ├── password.ts
│   └── seed.ts
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   └── ai-chat/
│   └── migrations/
├── deploy/
│   └── scripts/
├── nginx/
│   └── nerve.conf
├── public/
│   ├── favicon.svg
│   ├── placeholder.svg
│   └── robots.txt
├── docker-compose.yml
├── Dockerfile.api
├── README.md
└── DEPLOYMENT.md
```

## Critical Directories

### `src/`

**Purpose:** Active web-client codebase  
**Contains:** SPA bootstrap, route map, shared components, hooks, and feature pages  
**Entry Points:** `src/main.tsx`, `src/App.tsx`

### `src/components/`

**Purpose:** App shell and reusable client building blocks  
**Contains:** Layout, sidebar, access control, and `ui/` primitives  
**Integration:** `AppLayout` depends on both auth and app data providers

### `src/components/ui/`

**Purpose:** Shared design-system wrapper layer  
**Contains:** 49 shadcn-style/Radix-based UI primitives for forms, overlays, navigation, feedback, and data display

### `src/hooks/`

**Purpose:** Client state orchestration  
**Contains:** `useAuth.tsx` for session restore and dashboard routing, `useAppData.tsx` for bootstrap loading and mutations  
**Integration:** These hooks are the primary API-backed data path in the newer UI

### `src/lib/`

**Purpose:** Shared client-side utilities and data contracts  
**Contains:** API wrapper, app types, constants, helpers, and the legacy localStorage store  
**Integration:** `src/lib/api.ts` is the active client/server boundary; `src/lib/db.ts` remains a legacy local data source still used by older pages

### `src/pages/`

**Purpose:** Route-level screens  
**Contains:** Active shared pages plus `branding/` and `content/` team-specific dashboards, alongside some legacy generic dashboard files that are no longer wired into `src/App.tsx`  
**Integration:** Route access is enforced centrally by `RoleGuard`

### `server/`

**Purpose:** Active backend API  
**Contains:** Express bootstrap, environment loading, SQL layer, seed data, and password helpers  
**Entry Points:** `server/index.ts`

### `supabase/functions/ai-chat/`

**Purpose:** Retained cloud AI endpoint  
**Contains:** Deno Edge Function that proxies chat/newsletter generation to Anthropic  
**Integration:** Not called by the active client because the Supabase client is stubbed

### `supabase/migrations/`

**Purpose:** Retained database and storage schema history  
**Contains:** Roles, profiles, entries, attachments, RLS policies, triggers, and storage bucket setup

### `deploy/scripts/`

**Purpose:** Production operations automation  
**Contains:** Deploy, backup, restore, and restore-test scripts  
**Integration:** These scripts assume a VPS layout under `/srv/nerve`

### `nginx/`

**Purpose:** Production HTTP entrypoint configuration  
**Contains:** Nginx site config for static SPA hosting and `/api` proxying

## Entry Points

### Web Client

- **Main Entry:** `src/main.tsx`
- **Bootstrap:** Mounts `App.tsx` into the browser root element

### API Server

- **Entry Point:** `server/index.ts`
- **Bootstrap:** Loads env config, configures middleware, bootstraps the database, and starts Express on `API_PORT`

### Retained AI Endpoint

- **Entry Point:** `supabase/functions/ai-chat/index.ts`
- **Bootstrap:** Deno `serve()` handler with CORS and Anthropic streaming logic

## Integration Points

### `web-client -> api-server`

- **Location:** `src/lib/api.ts`
- **Type:** REST over same-origin `/api`
- **Details:** Browser fetches include credentials; Vite and Nginx both proxy requests to port `3001`

### `web-client -> retained supabase`

- **Location:** `src/integrations/supabase/client.ts`
- **Type:** Stubbed integration boundary
- **Details:** The file exports `null`, which keeps old imports compiling while disabling live Supabase calls

### `api-server -> PostgreSQL`

- **Location:** `server/db.ts`
- **Type:** Direct SQL via `pg`
- **Details:** Creates tables, seeds defaults, rotates bootstrap admin credentials, and stores sessions

### `retained supabase -> Anthropic`

- **Location:** `supabase/functions/ai-chat/index.ts`
- **Type:** HTTPS API call
- **Details:** Chat and newsletter requests are streamed to Anthropic when the Edge Function is deployed and configured

## File Organization Patterns

- Route screens are grouped by audience: shared pages at `src/pages/*.tsx`, team-specific dashboards in `src/pages/branding/` and `src/pages/content/`.
- Shared browser-facing behavior is centralized in providers (`useAuth`, `useAppData`) and common UI primitives under `src/components/ui/`.
- The server keeps all database logic in one large module (`server/db.ts`) instead of splitting repositories or services by domain.
- Cloud and deployment concerns are kept at the repo edge (`supabase/`, `deploy/`, `nginx/`) rather than mixed into the active SPA.

## Key File Types

### React pages and components

- **Pattern:** `src/**/*.tsx`
- **Purpose:** Route screens, layout, and reusable UI wrappers
- **Examples:** `src/App.tsx`, `src/pages/Browse.tsx`, `src/components/AppSidebar.tsx`

### Server modules

- **Pattern:** `server/**/*.ts`
- **Purpose:** API bootstrap, SQL access, config loading, and auth helpers
- **Examples:** `server/index.ts`, `server/db.ts`

### Migration files

- **Pattern:** `supabase/migrations/*.sql`
- **Purpose:** Retained schema and policy definition for the Supabase variant
- **Examples:** `supabase/migrations/20260324104905_52cd0f6e-6dce-470f-b9fb-ec7e234e99f1.sql`

### Ops scripts

- **Pattern:** `deploy/scripts/*.sh`
- **Purpose:** Deploy, backup, restore, and operational validation
- **Examples:** `deploy/scripts/deploy.sh`, `deploy/scripts/test-restore.sh`

## Asset Locations

- **Static public assets:** `public/` (3 files: favicon, placeholder image, robots)

## Configuration Files

- **`package.json`**: Shared scripts and dependencies for client and server
- **`vite.config.ts`**: Client dev server, aliasing, and `/api` proxy
- **`tsconfig.server.json`**: Backend TypeScript build to `dist-server/`
- **`.env.example`**: App, API, session, and database env contract
- **`docker-compose.yml`**: `db` and `api` runtime definitions
- **`Dockerfile.api`**: API image build based on Node 22
- **`nginx/nerve.conf`**: Production static hosting and reverse proxy setup
- **`supabase/config.toml`**: Retained Supabase project metadata

## Notes For Development

- Treat `src/lib/db.ts` as legacy code that still powers older dashboard files kept in the repo.
- Treat `useAppData()` as the active shared data layer for routed API-backed pages.
- When changing authentication or role behavior, inspect both `RoleGuard` and server-side authorization helpers such as `isBrandingManager()` and `canCreateManagedUser()`.
- When changing deployment behavior, update both the generated docs here and the existing root `DEPLOYMENT.md` runbook.

---

_Generated using BMAD Method `document-project` workflow_
