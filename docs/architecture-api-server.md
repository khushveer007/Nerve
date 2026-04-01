# Nerve - API Server Architecture

**Date:** 2026-04-02
**Part:** `api-server`
**Root:** `server/`
**Project Type:** Backend API

## Executive Summary

The API server is an Express 4 application written in TypeScript. It exposes cookie-authenticated REST endpoints for login, bootstrap data, entries, users, teams, and branding rows. All persistence currently goes through PostgreSQL via the `pg` driver and a single central module, `server/db.ts`.

On startup, the server bootstraps its schema, seeds built-in teams and sample users/entries, and rotates the configured super-admin credentials if the legacy bootstrap password is still present. Session state is also stored in PostgreSQL using `connect-pg-simple`, which makes the database a hard dependency for both data access and authentication.

## Technology Stack

| Category | Technology | Notes |
| --- | --- | --- |
| Runtime | Node.js 22 | Container image uses `node:22-bookworm-slim` |
| Framework | Express 4 | Route and middleware pipeline |
| Validation | Zod | Validates login, entry, user, team, and branding-row payloads |
| Database | PostgreSQL | Direct SQL through `pg` |
| Session layer | `express-session` + `connect-pg-simple` | Session data stored in PostgreSQL |
| Password hashing | `crypto.scrypt` | Salted hash storage in `password_hash` |
| Build tool | TypeScript + `tsx` | `tsx watch` for dev, `tsc -p tsconfig.server.json` for builds |

## Architecture Pattern

The server uses a compact layered structure:

- **Route layer:** `server/index.ts` defines middleware, validation, and endpoint handlers.
- **Data layer:** `server/db.ts` owns schema creation, seed data, mapping helpers, and CRUD SQL.
- **Config layer:** `server/config.ts` loads required env vars and guards invalid defaults.
- **Security utilities:** `server/password.ts` hashes and verifies passwords.
- **Seed definitions:** `server/seed.ts` holds built-in teams, users, entries, and bootstrap credential constants.

This is effectively a "thin controller plus shared repository module" architecture rather than a deeply separated service/repository/domain layout.

## Request Lifecycle

1. `server/index.ts` creates the Express app and enables JSON parsing.
2. Session middleware persists state to PostgreSQL via `PgStore`.
3. Public routes (`/api/health`, `/api/auth/*`) are evaluated first.
4. An auth gate on `/api` loads the current session user for all remaining routes.
5. Route handlers validate payloads with Zod and call functions from `server/db.ts`.
6. Errors are normalized into JSON `{ message }` responses.

## Authentication And Authorization

### Session Model

- Successful `POST /api/auth/login` stores `session.userId`.
- `GET /api/auth/me` restores the current session user.
- `POST /api/auth/logout` destroys the session and clears `connect.sid`.

### Role Rules

- Roles are `super_admin`, `admin`, `sub_admin`, and `user`.
- `super_admin` can manage all users and teams.
- `admin` can create subordinate users only within its own team.
- Branding-row routes require a branding manager: `super_admin` or any user assigned to the `branding` team.

### Helper Functions

- **`getSessionUser()`** resolves the current session user from the database.
- **`isBrandingManager()`** restricts branding row access.
- **`canCreateManagedUser()`** enforces admin-only team-scoped user creation.

## API Surface

### Public

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Authenticated

- `GET /api/bootstrap`
- `GET/POST/DELETE /api/entries`
- `GET/POST/PATCH/DELETE /api/users`
- `GET/POST/DELETE /api/teams`
- `GET/POST/PATCH/DELETE /api/branding-rows`

Detailed payloads and response expectations are documented in [api-contracts-api-server.md](./api-contracts-api-server.md).

## Data Architecture

### Current Active Tables

- **`teams`**: built-in and custom team definitions
- **`users`**: application users, roles, team assignment, password hashes
- **`entries`**: knowledge base records with metadata and inline JSON attachments
- **`branding_rows`**: branding-team operational rows
- **`session`**: implied table managed by `connect-pg-simple`

### Startup Behavior

`bootstrapDatabase()` performs the following:

1. Enables the `vector` extension if available.
2. Creates the core tables if they do not exist.
3. Seeds built-in teams.
4. Seeds users and entries if the tables are empty.
5. Rotates the seeded super-admin email/password to configured env values if the legacy defaults are still present.

### Important Constraint

The retained Supabase schema and the active API schema are not identical. The Supabase migration uses `admin/editor/viewer`, while the active API uses `super_admin/admin/sub_admin/user`.

## Source Tree

```text
server/
├── config.ts              # Required env loading and config normalization
├── connect-pg-simple.d.ts # Type bridge for session store package
├── db.ts                  # Schema creation, seed logic, CRUD SQL, row mapping
├── index.ts               # Express app, middleware, routes, startup
├── password.ts            # scrypt hash + verify helpers
└── seed.ts                # Built-in teams, users, entries, legacy bootstrap values
```

## Development Workflow

- Use `npm run dev:server` for local watch mode.
- Use `npm run build:server` to compile to `dist-server/`.
- Use `npm run start:server` to run the compiled output.
- Use `docker compose up -d db api` for the closest production-like local topology.

### Required Environment Variables

- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPER_ADMIN_PASSWORD`

### Optional Or Defaulted

- `API_PORT` defaults to `3001`
- `APP_BASE_URL` defaults to `http://127.0.0.1`
- `COOKIE_SECURE` defaults to `false`
- `SUPER_ADMIN_EMAIL` defaults to `super@parul.ac.in`

## Deployment Architecture

- The API container is built from `Dockerfile.api`.
- `docker-compose.yml` binds the API to `127.0.0.1:${API_PORT}`.
- Nginx proxies `/api/` to the local API container.
- Because sessions are DB-backed, API health depends on both the Node process and PostgreSQL availability.

## Testing Strategy

- There are no dedicated server unit or integration tests in the repo today.
- `npm test` currently exercises only a placeholder frontend Vitest test.
- Operational confidence currently comes more from deploy scripts and manual runbooks than from backend test coverage.

## Risks And Constraints

- `server/db.ts` is large and mixes schema management, seed logic, and CRUD operations in one module.
- Automatic startup seeding is convenient locally but requires care in production environments.
- Role semantics differ between the active API and retained Supabase assets.
- Attachment metadata exists in the active API model, but the active Express routes do not currently expose upload workflows.

---

_Generated using BMAD Method `document-project` workflow_
