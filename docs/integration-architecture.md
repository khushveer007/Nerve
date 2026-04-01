# Nerve - Integration Architecture

**Date:** 2026-04-02

## Executive Summary

Nerve currently runs as a same-origin web app where the browser loads a static React SPA and talks to an Express API through `/api`. The API persists application data and session state to PostgreSQL. The repo also retains Supabase schema and Edge Function assets, but that cloud integration is currently disconnected from the active frontend runtime.

## Active Runtime Flow

### Development

```text
Browser -> Vite dev server (:8080)
        -> /api proxy
        -> Express API (:3001)
        -> PostgreSQL
```

### Production

```text
Browser -> Nginx
        -> static SPA files from /srv/nerve/releases/current
        -> /api reverse proxy
        -> API container
        -> PostgreSQL container
```

## Integration Matrix

| From | To | Protocol / Mechanism | Status | Notes |
| --- | --- | --- | --- | --- |
| Browser SPA | Express API | `fetch` with cookies to `/api` | Active | Implemented in `src/lib/api.ts` |
| Vite dev server | Express API | HTTP proxy | Active | Configured in `vite.config.ts` |
| Nginx | Express API | Reverse proxy | Active | Configured in `nginx/nerve.conf` |
| Express API | PostgreSQL | `pg` SQL queries | Active | Centralized in `server/db.ts` |
| Express API | PostgreSQL | `connect-pg-simple` session store | Active | Session table created on demand |
| Web client | `src/lib/db.ts` local store | Browser `localStorage` | Legacy | Only older unrouted pages still use this |
| Web client | Supabase client | SDK call | Retained / inactive | `src/integrations/supabase/client.ts` exports `null` |
| Supabase Edge Function | Anthropic Messages API | HTTPS streaming request | Retained / inactive | Present in source but not wired to active SPA |

## Auth And Session Flow

1. The user signs in through `POST /api/auth/login`.
2. The API validates the password and stores `session.userId`.
3. The browser keeps the session cookie and restores auth with `GET /api/auth/me`.
4. `AppDataProvider` fetches bootstrap data from `GET /api/bootstrap`.
5. All authenticated `/api` routes resolve the current user from the session before handling the request.

## Data Flow

### Active Routed UI

1. `useAppData()` requests bootstrap data from the API.
2. Routed pages read entries, users, teams, and branding rows from provider state.
3. Mutations call REST endpoints, then update provider state locally.
4. The API writes changes to PostgreSQL.

### Legacy Repo-Only Flow

Some older dashboard files still call `src/lib/db.ts`, which loads and saves browser-side `localStorage` keys such as `pu_entries` and `pu_users`. These files are not wired into the active router, but they remain a source of schema and UX history.

## Current vs Retained Cloud Architecture

### Active

- Express owns auth, authorization, and data persistence.
- PostgreSQL stores both domain data and sessions.
- AI pages fall back locally when backend AI services are unavailable.

### Retained

- `supabase/migrations/` defines `profiles`, `user_roles`, `entries`, `attachments`, storage bucket policies, and RLS.
- `src/integrations/supabase/types.ts` contains generated TypeScript types for that retained schema.
- `supabase/functions/ai-chat/index.ts` implements a Deno endpoint that proxies prompts to Anthropic.

## Integration Risks And Drift

- The retained Supabase role model (`admin`, `editor`, `viewer`) does not match the active API role model (`super_admin`, `admin`, `sub_admin`, `user`).
- The active API includes `teams` and `branding_rows`, which are not represented in the retained Supabase schema.
- Legacy localStorage pages can be mistaken for active runtime integrations if contributors only scan the repo file list.
- The frontend includes a Supabase integration folder, but the actual client is stubbed and should not be treated as live.

## Deployment And Ops Touchpoints

- `docker-compose.yml` defines the active `db` and `api` runtime services.
- `deploy/scripts/deploy.sh` builds the app, runs lint/tests, restarts containers, and publishes static frontend assets.
- `nginx/nerve.conf` ties the static and API layers together in production.
- `deploy/scripts/backup-postgres.sh`, `restore-postgres.sh`, and `test-restore.sh` handle database operations around the runtime stack.

## Recommended Integration Reading Order

1. `architecture-web-client.md`
2. `architecture-api-server.md`
3. `api-contracts-api-server.md`
4. `data-models-api-server.md`
5. Root `README.md` and `DEPLOYMENT.md`

---

_Generated using BMAD Method `document-project` workflow_
