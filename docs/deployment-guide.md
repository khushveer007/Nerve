# Nerve - Deployment Guide

**Date:** 2026-04-02

## Overview

Nerve is deployed as a static frontend plus local API/database stack on an Ubuntu VPS. The frontend build is published into timestamped release directories and served by Nginx, while the API and PostgreSQL run through Docker Compose on the same machine.

This guide is the generated architectural summary. For the full command-by-command runbook and rollback notes, also read the existing root [DEPLOYMENT.md](../DEPLOYMENT.md).

## Runtime Topology

| Component | Runtime | Source | Notes |
| --- | --- | --- | --- |
| Frontend SPA | Static files served by Nginx | `dist/` -> `/srv/nerve/releases/current` | Client-side routing handled by `try_files ... /index.html` |
| API | Docker container | `Dockerfile.api` | Bound to `127.0.0.1:${API_PORT}` |
| Database | Docker container | `pgvector/pgvector:pg16` | Persistent volume under `POSTGRES_DATA_DIR` |
| Reverse proxy | Host Nginx | `nginx/nerve.conf` | Serves SPA and proxies `/api/` |

## Required Deployment Inputs

- VPS running Ubuntu
- Git access to the repo branch being deployed
- Node.js 22 on the host for frontend build steps
- Docker Engine and Docker Compose plugin
- An env file derived from `.env.example`

## Important Environment Variables

- `APP_BASE_URL`
- `API_PORT`
- `COOKIE_SECURE`
- `SESSION_SECRET`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATA_DIR`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Deployment Flow

### 1. Prepare the host

- Install Docker, Docker Compose, Nginx, Git, Rsync, and firewall prerequisites
- Create the persistent directory layout under `/srv/nerve`
- Configure Nginx site files and firewall rules

### 2. Provision env and code

- Clone the repo into `/srv/nerve/app`
- Copy the shared env file into place
- Ensure secrets and database coordinates are correct

### 3. Build and deploy

`deploy/scripts/deploy.sh` performs the main deploy sequence:

1. Clone or update the target branch
2. Copy the shared env file into the repo root as `.env`
3. Run `npm ci`
4. Run `npm run lint`
5. Run `npm test`
6. Run `npm run build`
7. Restart `db` and `api` with `docker compose --env-file ... up -d --build db api`
8. Publish `dist/` to a timestamped release directory
9. Move the `current` symlink to the new release
10. Validate Nginx config and reload Nginx

## Database Operations

### Backup

Use `deploy/scripts/backup-postgres.sh` to:

- load env values
- run `pg_dump` inside the `db` container
- gzip the dump
- prune backups older than `RETENTION_DAYS`

### Restore

Use `deploy/scripts/restore-postgres.sh` to restore a dump into a target database.

### Restore Validation

Use `deploy/scripts/test-restore.sh` to restore into a temporary database, query the `users` table, and then drop the temporary database.

## Production Request Flow

```text
User request
  -> Nginx
     -> static file from /srv/nerve/releases/current
     -> or /api proxy to 127.0.0.1:3001
        -> API container
           -> PostgreSQL container
```

## Verification Checklist

After deployment, verify:

- `docker compose ps`
- `docker compose logs api --tail=50`
- `curl -I http://<host>`
- `curl http://<host>/api/health`
- Browser access to `/login`

## Rollback Strategy

- Repoint `/srv/nerve/releases/current` to the previous release directory
- Reload Nginx
- Re-run `docker compose ... up -d api` if needed
- Restore PostgreSQL from a backup if the data layer must be reverted

## Risks And Notes

- API and DB share the same host, so host-level outages affect the entire stack.
- The build pipeline runs lint and tests during deploy, but the current test suite is very small.
- Session auth depends on PostgreSQL availability because the session store is DB-backed.
- The retained Supabase assets are not part of the active VPS deployment path.

---

_Generated using BMAD Method `document-project` workflow_
