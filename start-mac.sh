#!/usr/bin/env bash
# ============================================================================
# PantryButler — macOS (and Linux) startup script
#
#   ./start-mac.sh                  First run: builds containers, starts,
#                                   seeds nutrition, and creates the admin.
#   ./start-mac.sh --reset-db       Optional: wipe the database volume and
#                                   restart fresh (destroys all data!).
#   ./start-mac.sh --noupdate       Skip the git pull auto-update (local
#                                   testing before pushing to GitHub).
#   ./start-mac.sh --url <url>       Public base URL for email links, e.g.
#                                   https://pantrybutler.example.com
#                                   (without it, prompts when interactive;
#                                   otherwise email links use localhost).
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/docker/.env.2container"
COMPOSE_PROJECT="PantryButler"

green()  { printf "\033[0;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$*"; }
red()    { printf "\033[0;31m%s\033[0m\n" "$*"; }
step()   { printf "\n"; green "▶  $*"; }

docker_volume_exists() {
  docker volume inspect "$1" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
  local missing=0
  if ! command -v docker &>/dev/null; then
    red "❌ Docker is not installed."
    echo "   Install Docker Desktop for macOS:"
    echo "   https://www.docker.com/products/docker-desktop/"
    missing=1
  fi
  if ! docker compose version &>/dev/null; then
    red "❌ Docker Compose v2 is not available."
    echo "   Update Docker Desktop (Compose v2 ships with it)."
    missing=1
  fi
  [[ -f "$COMPOSE_FILE" ]] || { red "❌ $COMPOSE_FILE not found. Run this script from the project root."; missing=1; }
  [[ $missing -eq 1 ]] && exit 1
}

git_pull() {
  step "Checking for updates..."
  if ! command -v git &>/dev/null; then
    yellow "   ⚠️  git not found; skipping auto-update."
    return
  fi
  if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
    yellow "   ⚠️  Not a git repository; skipping auto-update."
    return
  fi
  if git -C "$PROJECT_ROOT" pull --ff-only 2>&1; then
    green "   Update check complete."
  else
    yellow "   ⚠️  git pull failed (network/credentials?) — continuing with current code."
  fi
}

# ---------------------------------------------------------------------------
# Environment / JWT secret
# ---------------------------------------------------------------------------
setup_env() {
  # On by default: scripts/smoke-test.py uses the superadmin admin instance-
  # delete API to leave no data behind.
  export ENABLE_ADMIN_FEATURES="${ENABLE_ADMIN_FEATURES:-true}"

  if [[ ! -f "$ENV_FILE" ]]; then
    step "Creating $ENV_FILE from template..."
    cp "${SCRIPT_DIR}/docker/.env.2container.example" "$ENV_FILE" 2>/dev/null \
      || printf 'POSTGRES_USER=pantrybutler\nPOSTGRES_PASSWORD=pb_local_9f2c4a7e_5b8d\nPOSTGRES_DB=pantrybutler\nJWT_SECRET=generate-a-random-64-char-string\nENABLE_ADMIN_FEATURES=true\n' > "$ENV_FILE"
  fi

  # Always ensure a real JWT_SECRET (never ship / run with a known value: the
  # placeholder or any leaked committed secret is forgeable — the server refuses
  # to boot with them).
  if grep -Eq '^JWT_SECRET=(generate-a-random-64-char-string|577a1c275181d034a9bfef43ad38f910f47694574cd55d149c924b4e1cba2732|706943d4abc630b909ea7e9364ff35eaff7a9b9fdde4dddc785a553870bef67d)$' "$ENV_FILE"; then
    step "Generating a secure JWT_SECRET..."
    local jwt_secret
    if command -v openssl &>/dev/null; then
      jwt_secret="$(openssl rand -hex 32)"
    else
      jwt_secret="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 64)"
    fi
    # macOS sed needs the '' argument; GNU sed does not.
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" "$ENV_FILE" 2>/dev/null \
      || sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" "$ENV_FILE"
    green "   JWT_SECRET generated."
  fi

  # Always use a real DB password: the server refuses to boot in production
  # with the well-known `changeme` placeholder (or the committed template
  # value), so rotate them to a random password like JWT_SECRET above.
  if grep -Eq '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)$' "$ENV_FILE"; then
    step "Generating a secure POSTGRES_PASSWORD..."
    # A Postgres data volume freezes its password at first init. If one already
    # exists, do NOT rotate: changing the env value would desync the app from the
    # database (migrations/login fail with "password authentication failed") and
    # the only fix would be wiping the volume. So only rotate on a fresh install
    # (no existing volume); otherwise leave the password as-is.
    if docker_volume_exists "PantryButler_pgdata"; then
      yellow "   ↳ A DB volume already exists — leaving POSTGRES_PASSWORD unchanged so it stays in sync with the database."
      yellow "   To start fresh, remove the volume (docker compose down -v) and re-run."
    else
      local db_password
      if command -v openssl &>/dev/null; then
        db_password="$(openssl rand -hex 16)"
      else
        db_password="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 32)"
      fi
      sed -i '' "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_password|" "$ENV_FILE" 2>/dev/null \
        || sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_password|" "$ENV_FILE"
      green "   POSTGRES_PASSWORD generated."
    fi
  fi
}

# ---------------------------------------------------------------------------
# External / public URL (used in email verification links)
# ---------------------------------------------------------------------------
write_app_url() {
  local val="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  if grep -Eq '^APP_URL=' "$ENV_FILE"; then
    sed -i '' "s|^APP_URL=.*|APP_URL=$val|" "$ENV_FILE" 2>/dev/null \
      || sed -i "s|^APP_URL=.*|APP_URL=$val|" "$ENV_FILE"
  else
    printf 'APP_URL=%s\n' "$val" >> "$ENV_FILE"
  fi
}

configure_external_url() {
  local cli_url="${1:-}"
  local url="$cli_url"

  # An explicit value (--url) or existing env var wins over prompting.
  if [[ -z "$url" && -n "${APP_URL:-}" ]]; then
    url="$APP_URL"
  fi

  # Already pinned in the env file: respect it, no prompt.
  if [[ -z "$url" && -f "$ENV_FILE" ]]; then
    local existing
    existing="$(grep -E '^APP_URL=' "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2-)" || true
    if [[ -n "$existing" ]]; then
      green "   Using APP_URL from $ENV_FILE: $existing"
      return 0
    fi
  fi

  if [[ -n "$url" ]]; then
    url="$(echo "$url" | sed 's:/*$::')"
    write_app_url "$url"
    green "   APP_URL set to $url (saved to $ENV_FILE)."
    return 0
  fi

  # Nothing provided: only prompt when attached to an interactive terminal.
  if [[ ! -t 0 ]]; then
    yellow "   ℹ️  Non-interactive run: APP_URL left unset (email links will use localhost)."
    yellow "   Set APP_URL=https://your.domain in docker/.env.2container to fix email links."
    return 0
  fi

  local input=""
  read -r -p $'\033[0;33m   Public URL for email links (e.g. https://pantrybutler.example.com), or leave blank for localhost: \033[0m' input || true
  input="$(echo "$input" | sed 's:/*$::')"
  if [[ -n "$input" ]]; then
    write_app_url "$input"
    green "   APP_URL set to $input (saved to $ENV_FILE)."
  else
    yellow "   No public URL provided — email links will use localhost."
  fi
}

# ---------------------------------------------------------------------------
# Start / restart
# ---------------------------------------------------------------------------
start_containers() {
  cd "$PROJECT_ROOT"
  step "Building and starting containers (project: $COMPOSE_PROJECT)..."
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

  step "Waiting for the app to become healthy..."
  local attempts=0 max=60
  until docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    exec pantrybutler wget --no-verbose --tries=1 --spider http://localhost:3000/api/health &>/dev/null; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge $max ]]; then
      red "❌ App did not become healthy within ${max}s."
      yellow "   Check logs:  docker compose -p PantryButler logs pantrybutler"
      exit 1
    fi
    sleep 2
  done
  green "   App is healthy."
}

reset_db() {
  red "⚠️  DESTRUCTIVE: removing the PostgreSQL data volume (all data will be lost)."
  docker compose -p "$COMPOSE_PROJECT" down -v
  green "   Database volume removed. Restarting fresh..."
}

show_summary() {
  echo ""
  green "══════════════════════════════════════════════════════"
  green "  PantryButler is running"
  green "  App:          http://localhost:3000"
  green "  Health:       http://localhost:3000/api/health"
  green "  Containers:   docker compose -p $COMPOSE_PROJECT ps"
  green "  Logs:         docker compose -p $COMPOSE_PROJECT logs -f"
  green "══════════════════════════════════════════════════════"
  echo ""
  yellow "Open http://localhost:3000 and sign in (first boot creates an admin automatically)."
  if grep -Eq '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)$' "$ENV_FILE"; then
    yellow "Production? Change POSTGRES_PASSWORD in docker/.env.2container and"
    yellow "restart (docker compose -p PantryButler up -d)."
  fi
}

run_setup() {
  step "Checking if setup is needed..."

  # The status endpoint requires superadmin auth once any users exist, so an
  # unauthenticated call returns non-2xx. Only a *successful* response that
  # reports hasUsers:false means a genuine first boot; anything else (fetch
  # failure, 403, already-set-up) is treated as "nothing to do" so we don't
  # re-run seeding / admin creation on every update.
  local setup_status
  setup_status="$(curl -sf http://localhost:3000/api/setup/status 2>/dev/null || true)"

  if echo "$setup_status" | grep -q '"hasUsers":false'; then
    green "   First boot detected — running setup..."

    step "Seeding nutrition data..."
    local seed_response
    seed_response="$(curl -sf -X POST http://localhost:3000/api/setup/seed-nutrition 2>/dev/null || true)"
    if echo "$seed_response" | grep -q '"success":true'; then
      green "   Nutrition data seeded successfully."
    else
      yellow "   ⚠️  Nutrition seed response: $seed_response"
    fi

    step "Creating admin user..."
    local admin_email="${ADMIN_EMAIL:-admin@pantrybutler.local}"
    local admin_password="${ADMIN_PASSWORD:-}"
    # Reuse a previously generated admin password persisted in the env file, so a
    # database-volume reset during an update does not replace it with a new,
    # unknown password.
    if [[ -z "$admin_password" && -f "$ENV_FILE" ]]; then
      admin_password="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | head -n1 | cut -d= -f2- || true)"
    fi
    if [[ -z "$admin_password" ]]; then
      if command -v openssl &>/dev/null; then
        admin_password="$(openssl rand -hex 12)"
      else
        admin_password="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 24)"
      fi
      if [[ -f "$ENV_FILE" ]] && ! grep -Eq '^ADMIN_PASSWORD=' "$ENV_FILE"; then
        printf 'ADMIN_PASSWORD=%s\n' "$admin_password" >> "$ENV_FILE"
      fi
    fi

    local register_response
    register_response="$(curl -sf -X POST http://localhost:3000/api/setup/create-admin \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$admin_email\",\"password\":\"$admin_password\",\"instance_name\":\"My Kitchen\"}" 2>/dev/null || true)"

    if echo "$register_response" | grep -q '"success":true'; then
      green "   Admin user created: $admin_email"
    else
      yellow "   ⚠️  Register response: $register_response"
    fi

    green ""
    green "╔═══════════════════════════════════════════════════════════════╗"
    green "║                    SETUP COMPLETE                           ║"
    green "╠═══════════════════════════════════════════════════════════════╣"
    green "║  Admin email:    $admin_email"
    green "║  Admin password: $admin_password"
    green "║  App URL:        http://localhost:3000"
    green "╚═══════════════════════════════════════════════════════════════╝"
    green ""
    if [[ ${#admin_password} -lt 12 || "$admin_password" == "admin123" ]]; then
      yellow "⚠️  CHANGE THE ADMIN PASSWORD AFTER FIRST LOGIN!"
    fi
    if grep -Eq '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)$' "$ENV_FILE"; then
      yellow "⚠️  CHANGE POSTGRES_PASSWORD IN docker/.env.2container FOR PRODUCTION!"
    fi
  else
    green "   Setup already complete."
  fi
}

main() {
  echo ""
  green "PantryButler — macOS startup"

  local no_update=0
  local cli_url=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --noupdate) no_update=1; shift ;;
      --reset-db) reset_db; shift ;;
      --enable-admin-features) export ENABLE_ADMIN_FEATURES=true; shift ;;
      --url) cli_url="$2"; shift 2 ;;
      --url=*) cli_url="${1#--url=}"; shift ;;
      *) shift ;;
    esac
  done

  check_prerequisites
  if [[ $no_update -eq 0 ]]; then
    git_pull
  fi

  setup_env
  configure_external_url "$cli_url"
  start_containers
  run_setup
  show_summary
}

main "$@"