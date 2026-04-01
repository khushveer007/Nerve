# Troubleshooting

## App Loads but Login Fails

Checks:

```bash
docker compose --env-file /srv/nerve/shared/env/.env -f /srv/nerve/app/docker-compose.yml logs api --tail=100
docker compose --env-file /srv/nerve/shared/env/.env -f /srv/nerve/app/docker-compose.yml exec db psql -U nerve_app -d nerve -c "SELECT email, role FROM users;"
```

Common fixes
- Confirm `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`
- Make sure the API can connect to `db:5432`
- Clear browser cookies and try again

What changed
- Verified auth seed data and session connectivity

How to verify
- `curl http://173.230.138.42/api/health`
- Successful login in the browser

Rollback steps
- Restore the previous env file or database backup

## Nginx Shows 502 Bad Gateway

Checks:

```bash
systemctl status nginx --no-pager
docker compose --env-file /srv/nerve/shared/env/.env -f /srv/nerve/app/docker-compose.yml ps
curl http://127.0.0.1:3001/api/health
```

Common fixes
- Restart the API container
- Confirm `API_PORT=3001`
- Re-test Nginx config with `nginx -t`

What changed
- Verified proxy target and API health

How to verify
- `curl http://173.230.138.42/api/health`

Rollback steps
- Repoint Nginx to the previous working release and reload

## Database Container Fails to Start

Checks:

```bash
docker compose --env-file /srv/nerve/shared/env/.env -f /srv/nerve/app/docker-compose.yml logs db --tail=100
ls -ld /srv/nerve/data/postgres
```

Common fixes
- Check disk space with `df -h`
- Confirm the data directory exists and is writable
- Verify the database password variables match

What changed
- Verified container startup inputs and persistent volume path

How to verify
- `docker compose ... ps`
- `docker compose ... exec db pg_isready -U nerve_app -d nerve`

Rollback steps
- Stop the stack and restore the previous data directory backup

## Build or Deploy Script Fails

Checks:

```bash
cd /srv/nerve/app
git status
npm run lint
npm test
npm run build
```

Common fixes
- Make sure the upstream repo and `main` branch are reachable, or set `REPO_URL` and `BRANCH` overrides before running the deploy script
- Re-run `npm ci`
- Check the shared `.env` path used by the deploy script

What changed
- Isolated whether the failure is code, env, or infrastructure

How to verify
- The deploy script exits cleanly and Nginx reload succeeds

Rollback steps
- Switch `/srv/nerve/releases/current` back to the previous release
- Redeploy the last known-good commit

## Local Dev Script Fails

Checks:

```bash
test -f .env.local
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.local ps
curl http://127.0.0.1:3001/api/health
```

Common fixes
- Copy `.env.local.example` to `.env.local` and replace the placeholder secrets
- Confirm `DATABASE_URL` uses `127.0.0.1:5432` for host-based API development
- Stop any process already using ports `8080`, `3001`, or `5432`

What changed
- Isolated whether the issue is local env setup, Docker PostgreSQL startup, or host dev processes

How to verify
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.local ps`
- `curl http://127.0.0.1:3001/api/health`

Rollback steps
- Stop the script with `Ctrl+C`
- Remove the dev stack with `docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.local down`
