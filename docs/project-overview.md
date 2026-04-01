# Nerve - Project Overview

**Date:** 2026-04-02
**Type:** Multi-part TypeScript application
**Architecture:** React SPA + Express API + PostgreSQL + retained Supabase assets

## Executive Summary

Nerve is a role-based knowledge hub for Parul University teams. The repository currently contains two active runtime parts: a Vite/React single-page app in `src/` and an Express/PostgreSQL API in `server/`. The repo also retains Supabase migrations, generated database types, and a Deno Edge Function for AI chat/newsletter generation, but the client connector is intentionally stubbed, so that cloud path is not part of the live frontend runtime today.

The codebase is in a transitional state. The active routed experience in `src/App.tsx` uses the API through `src/lib/api.ts` and `src/hooks/useAppData.tsx`, while several older generic dashboard files remain in the repo and still read directly from the legacy browser `localStorage` helper in `src/lib/db.ts`. That split is the most important architectural nuance to understand before planning new work.

## Project Classification

- **Repository Type:** Multi-part app in a single npm workspace
- **Project Type(s):** Web frontend (`web-client`) and backend API (`api-server`)
- **Primary Language(s):** TypeScript, SQL, Bash
- **Architecture Pattern:** Session-based client/server app with retained cloud artifacts

## Multi-Part Structure

### Web Client

- **Type:** Web frontend
- **Location:** `src/`
- **Purpose:** Role-gated SPA for login, dashboards, browsing, entry creation, team operations, export, and AI-assisted workflows
- **Tech Stack:** React 18, React Router, Vite, Tailwind CSS, Radix UI, Lucide, custom context providers

### API Server

- **Type:** Backend API
- **Location:** `server/`
- **Purpose:** Session-authenticated REST API with PostgreSQL-backed users, teams, entries, branding rows, and bootstrap data loading
- **Tech Stack:** Express 4, `pg`, `express-session`, `connect-pg-simple`, Zod, Node 22

### Supporting Cloud Assets

- **Location:** `supabase/`
- **Purpose:** Retained schema, generated types, and Edge Function code that describe a cloud-hosted variant of the product
- **Tech Stack:** Supabase SQL migrations, generated TS types, Deno Edge Functions, Anthropic API integration

### How Parts Integrate

The active browser runtime calls `/api` through `src/lib/api.ts`. In development, Vite proxies those requests to `http://127.0.0.1:3001` via `vite.config.ts`; in production, Nginx proxies `/api` to the same API port. The API persists data and sessions into PostgreSQL. Separately, the repo retains a Supabase AI path (`supabase/functions/ai-chat/index.ts`), but `src/integrations/supabase/client.ts` currently exports `null`, so the main client does not talk to Supabase at runtime.

## Technology Stack Summary

### Web Client Stack

| Category | Technology | Version / Source | Notes |
| --- | --- | --- | --- |
| Language | TypeScript | `package.json` / `tsconfig.json` | Shared client language |
| UI runtime | React | `18.3.1` | App shell and page rendering |
| Routing | React Router | `6.30.1` | Role- and team-specific route map in `src/App.tsx` |
| Bundler | Vite | `5.4.19` | Local dev server and static build |
| Styling | Tailwind CSS | `3.4.17` | Utility styling with shared component classes |
| UI primitives | Radix UI + shadcn-style wrappers | multiple packages | `src/components/ui/` contains 49 reusable primitives |
| Charts | Recharts | `2.15.4` | Used by dashboard views |
| Data access | Custom fetch wrapper | `src/lib/api.ts` | Cookie-based API client |
| Legacy local state | Browser `localStorage` store | `src/lib/db.ts` | Still used by older dashboards |

### API Server Stack

| Category | Technology | Version / Source | Notes |
| --- | --- | --- | --- |
| Language | TypeScript | `tsconfig.server.json` | NodeNext server build |
| Runtime | Node.js | `Dockerfile.api` uses Node 22 | Local dev uses `tsx watch` |
| Framework | Express | `4.21.2` | REST API and middleware pipeline |
| Validation | Zod | `3.25.76` | Request payload validation |
| Session store | `express-session` + `connect-pg-simple` | `package.json` | Sessions persisted in PostgreSQL |
| Database driver | `pg` | `8.16.3` | Direct SQL access from `server/db.ts` |
| Password hashing | Node `crypto.scrypt` | `server/password.ts` | Salted hash storage |

### Retained Cloud Stack

| Category | Technology | Source | Notes |
| --- | --- | --- | --- |
| Auth / data | Supabase | `supabase/` | Retained schema and project metadata |
| AI function runtime | Deno Edge Functions | `supabase/functions/ai-chat/index.ts` | Streams Anthropic responses |
| LLM provider | Anthropic Messages API | Edge Function fetch call | Used for chat/newsletter generation when deployed |

## Key Features

- Role-based authentication with `super_admin`, `admin`, `sub_admin`, and `user` access levels
- Team-specific experiences for `branding` and `content`, plus support for custom teams in the API and legacy store
- Entry browse, filter, create, delete, and export flows
- Team and user management for super admins and team leads
- Branding-specific row management for operational tracking
- AI query and newsletter generation screens with local fallback behavior when the backend AI path is disconnected
- VPS-oriented deployment automation with Docker, Nginx, backup, restore, and rollback scripts

## Architecture Highlights

- The active routed frontend is API-backed, but legacy unrouted dashboard files still use `src/lib/db.ts` directly.
- `src/App.tsx` wraps the app in `QueryClientProvider`, but React Query hooks are not currently used anywhere else in the repo.
- The API creates tables on startup in `bootstrapDatabase()` and seeds built-in teams, users, and sample entries automatically.
- Sessions are stored in PostgreSQL, so browser auth state depends on both the API and the database being available.
- Supabase artifacts remain in source control and are still useful reference material for future migrations or reconnection work.

## Development Overview

### Prerequisites

- Node.js 22.x
- npm
- PostgreSQL 16+ for direct local API runs, or Docker / Docker Compose for the bundled `db` service
- A valid `.env` file derived from `.env.example`

### Getting Started

1. Run `npm ci`
2. Copy `.env.example` to `.env.local` or `.env` and fill in the required secrets
3. Start the API with `npm run dev:server` or `docker compose up -d db api`
4. Start the web client with `npm run dev`

### Key Commands

#### Web Client

- **Install:** `npm ci`
- **Dev:** `npm run dev`
- **Build:** `npm run build:client`
- **Test:** `npm test`

#### API Server

- **Dev:** `npm run dev:server`
- **Build:** `npm run build:server`
- **Start compiled server:** `npm run start:server`
- **Containers:** `docker compose up -d db api`

## Repository Structure

- `src/` contains the SPA shell, routes, shared UI primitives, client data hooks, and retained Supabase client files.
- `server/` contains the active API, schema bootstrap logic, seed data, auth helpers, and environment loading.
- `supabase/` contains the retained SQL schema, generated database typings, and the AI Edge Function.
- `deploy/scripts/` and `nginx/` contain production deployment and operational automation.

## Documentation Map

For deeper detail, start with:

- [index.md](./index.md) - Master navigation for all generated docs
- [architecture-web-client.md](./architecture-web-client.md) - Frontend architecture and hybrid state model
- [architecture-api-server.md](./architecture-api-server.md) - API, auth, and data-layer architecture
- [integration-architecture.md](./integration-architecture.md) - Cross-part request, auth, and deployment flow
- [source-tree-analysis.md](./source-tree-analysis.md) - Annotated directory structure

---

_Generated using BMAD Method `document-project` workflow_
