#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SCRIPT_PATH="dev-stack.sh"
COMMAND="${1:-up}"
SEED=false
ENSURE_USERS=false

print_help() {
  cat <<EOF
Usage:
  ./$SCRIPT_PATH up [--seed]
  ./$SCRIPT_PATH down
  ./$SCRIPT_PATH help

Commands:
  up       Start PostgreSQL via Docker Compose, apply Prisma migrations, then launch frontend + API.
  down     Stop the Docker Compose database services started for local development.
  help     Show this help message.

Options:
  --seed   Run \`npm run db:seed\` after migrations. Warning: this resets seeded data.
  --dev-users   Run \`npm run db:ensure-users\` after migrations.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env_file() {
  local env_file

  if [ -f ".env" ]; then
    env_file=".env"
  elif [ -f ".env.example" ]; then
    env_file=".env.example"
  else
    echo "Neither .env nor .env.example was found." >&2
    exit 1
  fi

  echo "Using environment file: $env_file"

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=("docker" "compose")
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=("docker-compose")
    return
  fi

  echo "Docker Compose is required but was not found." >&2
  exit 1
}

compose() {
  "${COMPOSE_CMD[@]}" "$@"
}

ensure_port_available() {
  local port="$1"
  local service_name="$2"

  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use, so $service_name cannot start." >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    echo "Stop the process above or change the port before rerunning ./$SCRIPT_PATH up." >&2
    exit 1
  fi
}

wait_for_database() {
  local attempt=0
  local max_attempts=60

  echo "Waiting for PostgreSQL to become ready..."

  while ! compose exec -T db pg_isready -U postgres -d openhackathon >/dev/null 2>&1; do
    attempt=$((attempt + 1))

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "PostgreSQL did not become ready within ${max_attempts} seconds." >&2
      exit 1
    fi

    sleep 1
  done
}

start_stack() {
  require_command docker
  require_command npm
  require_command npx

  load_env_file
  resolve_compose_cmd

  echo "Starting PostgreSQL container..."
  compose up -d db

  wait_for_database

  echo "Applying Prisma migrations..."
  npx prisma migrate deploy

  if [ "$SEED" = true ]; then
    echo "Running seed data reset..."
    npm run db:seed
  elif [ "$ENSURE_USERS" = true ]; then
    echo "Ensuring development accounts..."
    npm run db:ensure-users
  else
    echo "Skipping default user bootstrap. Use Setup Wizard to create the first admin account."
  fi

  ensure_port_available "${PORT:-3001}" "the API server"
  ensure_port_available "5173" "the Vite dev server"

  echo
  echo "Starting frontend and API:"
  echo "  Frontend: http://localhost:5173"
  echo "  API:      http://localhost:${PORT:-3001}"
  echo "  Database: postgres://postgres:postgrespassword@localhost:5432/openhackathon"
  echo
  echo "Press Ctrl+C to stop the frontend/API processes."
  echo "Run 'npm run dev:down' to stop the Docker database container."
  echo

  exec npm run dev
}

stop_stack() {
  require_command docker
  resolve_compose_cmd

  echo "Stopping PostgreSQL container..."
  compose stop db >/dev/null 2>&1 || true
}

case "$COMMAND" in
  up)
    if [ "$#" -gt 0 ]; then
      shift
    fi

    for arg in "$@"; do
      case "$arg" in
        --seed)
          SEED=true
          ;;
        --dev-users)
          ENSURE_USERS=true
          ;;
        *)
          echo "Unknown option for 'up': $arg" >&2
          print_help >&2
          exit 1
          ;;
      esac
    done

    start_stack
    ;;
  down)
    stop_stack
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    print_help >&2
    exit 1
    ;;
esac
