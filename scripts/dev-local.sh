#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.local}"
COMPOSE_ARGS=(
  docker compose
  -f "$ROOT_DIR/docker-compose.yml"
  -f "$ROOT_DIR/docker-compose.dev.yml"
  --env-file "$ENV_FILE"
)
API_PID=""
WORKER_PID=""
WEB_PID=""
DB_CONTAINER_ID=""
CLEANUP_WATCHER_PID=""

has_value() {
  local value="${1:-}"
  [ -n "${value// }" ]
}

validate_local_assistant_config() {
  if has_value "${ASSISTANT_EMBEDDING_DIMENSIONS:-}" && [ "${ASSISTANT_EMBEDDING_DIMENSIONS}" != "1536" ]; then
    echo "ASSISTANT_EMBEDDING_DIMENSIONS must stay set to 1536 for local dev." >&2
    exit 1
  fi

  if has_value "${ASSISTANT_EMBEDDING_API_KEY:-}" && ! has_value "${ASSISTANT_EMBEDDING_URL:-}"; then
    echo "ASSISTANT_EMBEDDING_API_KEY is set but ASSISTANT_EMBEDDING_URL is empty." >&2
    exit 1
  fi

  if has_value "${ASSISTANT_ANSWER_API_KEY:-}" && ! has_value "${ASSISTANT_ANSWER_URL:-}"; then
    echo "ASSISTANT_ANSWER_API_KEY is set but ASSISTANT_ANSWER_URL is empty." >&2
    exit 1
  fi
}

print_local_assistant_summary() {
  local embedding_mode="disabled"
  local answer_mode="disabled"

  if has_value "${ASSISTANT_EMBEDDING_URL:-}"; then
    embedding_mode="enabled (${ASSISTANT_EMBEDDING_MODEL:-text-embedding-3-small})"
  fi

  if has_value "${ASSISTANT_ANSWER_URL:-}"; then
    answer_mode="enabled (${ASSISTANT_ANSWER_MODEL:-gpt-4.1-mini})"
  fi

  echo "Assistant local-dev configuration:"
  echo "  RAG enabled: ${ASSISTANT_RAG_ENABLED:-true}"
  echo "  Embeddings: $embedding_mode"
  echo "  Answer generation: $answer_mode"

  if ! has_value "${ASSISTANT_EMBEDDING_URL:-}"; then
    echo "  Note: retrieval will stay lexical-only until ASSISTANT_EMBEDDING_URL is configured."
  fi

  if ! has_value "${ASSISTANT_ANSWER_URL:-}"; then
    echo "  Note: Ask mode will abstain or fall back without grounded answer generation until ASSISTANT_ANSWER_URL is configured."
  fi
}

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM

  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi

  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi

  wait "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
  wait "$WORKER_PID" 2>/dev/null || true

  "${COMPOSE_ARGS[@]}" down --remove-orphans >/dev/null 2>&1 || true

  if [ -n "$CLEANUP_WATCHER_PID" ] && kill -0 "$CLEANUP_WATCHER_PID" 2>/dev/null; then
    kill "$CLEANUP_WATCHER_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}

wait_for_db() {
  local status

  DB_CONTAINER_ID="$("${COMPOSE_ARGS[@]}" ps -q db)"
  if [ -z "$DB_CONTAINER_ID" ]; then
    echo "Could not determine the local PostgreSQL container id." >&2
    exit 1
  fi

  echo "Waiting for PostgreSQL to become healthy..."
  while true; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$DB_CONTAINER_ID" 2>/dev/null || true)"

    case "$status" in
      healthy)
        break
        ;;
      unhealthy)
        echo "Local PostgreSQL failed its healthcheck." >&2
        "${COMPOSE_ARGS[@]}" logs db || true
        exit 1
        ;;
      *)
        sleep 2
        ;;
    esac
  done
}

start_db_cleanup_watcher() {
  local parent_pid="$1"

  (
    trap '' INT TERM

    while kill -0 "$parent_pid" 2>/dev/null; do
      sleep 1
    done

    "${COMPOSE_ARGS[@]}" down --remove-orphans >/dev/null 2>&1 || true
  ) &

  CLEANUP_WATCHER_PID=$!
}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing local env file: $ENV_FILE" >&2
  echo "Copy .env.local.example to .env.local and fill in the placeholder secrets." >&2
  exit 1
fi

trap cleanup EXIT INT TERM

echo "Starting local PostgreSQL with Docker Compose..."
"${COMPOSE_ARGS[@]}" up -d db
wait_for_db

set -a
source "$ENV_FILE"
set +a

validate_local_assistant_config
print_local_assistant_summary

start_db_cleanup_watcher "$$"

echo "Starting API on http://127.0.0.1:${API_PORT:-3001}"
(
  cd "$ROOT_DIR"
  npm run dev:server
) &
API_PID=$!

echo "Starting RAG worker"
(
  cd "$ROOT_DIR"
  npm run dev:worker
) &
WORKER_PID=$!

echo "Starting Vite on http://127.0.0.1:8080"
(
  cd "$ROOT_DIR"
  npm run dev
) &
WEB_PID=$!

echo "Local dev is running."
echo "Login with ${SUPER_ADMIN_EMAIL:-super@parul.ac.in} and the SUPER_ADMIN_PASSWORD from $(basename "$ENV_FILE")."

wait -n "$API_PID" "$WORKER_PID" "$WEB_PID"
