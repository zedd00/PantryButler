#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.2container"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
# Flags: --enable-admin-features (force admin pages on), --noupdate (skip git
# pull), --url <url> (public base URL for email links, e.g.
# https://pantrybutler.example.com). Without --url the script prompts when run
# interactively, otherwise leaves APP_URL unset (links use localhost).

green()  { echo -e "\033[0;32m$*\033[0m"; }
yellow() { echo -e "\033[0;33m$*\033[0m"; }
red()    { echo -e "\033[0;31m$*\033[0m"; }
step()   { echo; green "▶  $*"; }

docker_volume_exists() {
  docker volume inspect "$1" >/dev/null 2>&1
}

# ── Prerequisites ──
check_prerequisites() {
  local missing=0
  if ! command -v docker &>/dev/null; then
    red "❌ Docker is not installed."
    missing=1
  fi
  if ! docker compose version &>/dev/null; then
    red "❌ Docker Compose v2 is not available."
    missing=1
  fi
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    red "❌ $COMPOSE_FILE not found. Run this script from the project root."
    missing=1
  fi
  if [[ $missing -eq 1 ]]; then
    exit 1
  fi
}

# ── Auto-update ──
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

# ── Environment file ──
rotate_jwt_secret() {
  local jwt_secret
  if command -v openssl &>/dev/null; then
    jwt_secret="$(openssl rand -hex 32)"
  else
    jwt_secret="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  fi
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE"
  else
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE"
  fi
  green "   JWT_SECRET regenerated (placeholder detected)."
}

rotate_db_password() {
  local db_password
  if command -v openssl &>/dev/null; then
    db_password="$(openssl rand -hex 16)"
  else
    db_password="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  fi
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_password/" "$ENV_FILE"
  else
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_password/" "$ENV_FILE"
  fi
  green "   POSTGRES_PASSWORD regenerated (weak placeholder detected)."
}

setup_env() {
  # Feature switch: enable the superadmin-only Admin Instances / Admin
  # Announcements pages. On by default: scripts/smoke-test.py relies on the
  # admin instance-delete API to leave no data behind.
  export ENABLE_ADMIN_FEATURES="${ENABLE_ADMIN_FEATURES:-true}"

  if [[ ! -f "$ENV_FILE" ]]; then
    step "Creating $ENV_FILE from template..."

    if [[ -f "${SCRIPT_DIR}/.env.2container.example" ]]; then
      cp "${SCRIPT_DIR}/.env.2container.example" "$ENV_FILE"
    fi

    green "   Created $ENV_FILE — edit POSTGRES_PASSWORD before production use."
  else
    step "Using existing $ENV_FILE"
  fi

  # The committed template ships a known, forgeable JWT_SECRET (the placeholder
  # or a leaked committed value). Rotate it before boot: the server refuses to
  # start with a known signing secret, since it lets anyone impersonate any
  # user. Do NOT commit the regenerated secret to the repo.
  if grep -Eq '^JWT_SECRET=(generate-a-random-64-char-string|577a1c275181d034a9bfef43ad38f910f47694574cd55d149c924b4e1cba2732|706943d4abc630b909ea7e9364ff35eaff7a9b9fdde4dddc785a553870bef67d)$' "$ENV_FILE"; then
    yellow "   ⚠️  $ENV_FILE still uses a known, forgeable JWT_SECRET."
    rotate_jwt_secret
  fi

  # Same for the DB password: the server refuses to boot in production with
  # the well-known `changeme` placeholder (or the committed template value).
  # Rotate it so the app and db containers stay in sync on a fresh volume.
  if grep -Eq '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)$' "$ENV_FILE"; then
    yellow "   ⚠️  $ENV_FILE still uses a known, weak POSTGRES_PASSWORD."
    # A Postgres data volume freezes its password at first init. If one already
    # exists, do NOT rotate: changing the env value would desync the app from the
    # database (migrations/login fail with "password authentication failed") and
    # the only fix would be wiping the volume. So only rotate on a fresh install
    # (no existing volume); otherwise leave the password as-is.
    if docker_volume_exists "PantryButler_pgdata"; then
      yellow "   ↳ A DB volume already exists — leaving POSTGRES_PASSWORD unchanged so it stays in sync with the database."
      yellow "   To start fresh, remove the volume (docker compose down -v) and re-run."
    else
      rotate_db_password
    fi
  fi
}

# ── External / public URL (used in email verification links) ──
write_app_url() {
  local val="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  # APP_URL and CORS_ORIGIN both point at the public domain so the web app,
  # email links, and the browser-extension OAuth flow all use it (not localhost).
  for key in APP_URL CORS_ORIGIN; do
    if grep -Eq "^$key=" "$ENV_FILE"; then
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s|^$key=.*|$key=$val|" "$ENV_FILE"
      else
        sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
      fi
    else
      printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    fi
  done
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
    yellow "   Set APP_URL=https://your.domain in $ENV_FILE to fix email links."
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

# ── Start containers ──
start_containers() {
  step "Starting containers..."
  cd "$PROJECT_ROOT"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

  step "Waiting for the app to be healthy..."
  local attempts=0
  local max_attempts=30
  until docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec pantrybutler \
    wget --no-verbose --tries=1 --spider http://localhost:3000/api/health &>/dev/null; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge $max_attempts ]]; then
      red "❌ App did not become healthy within $max_attempts seconds."
      red "   Check logs: docker compose -f $COMPOSE_FILE logs pantrybutler"
      exit 1
    fi
    sleep 2
  done
  green "   App is healthy!"
}

# ── First-time setup ──
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

    # Seed nutrition data first (server reads the file directly). This must run
    # BEFORE creating any user: /api/setup/seed-nutrition rejects once a user
    # exists (first-boot-bootstrap-only guard).
    step "Seeding nutrition data..."
    local seed_response
    seed_response="$(curl -sf -X POST http://localhost:3000/api/setup/seed-nutrition 2>/dev/null || true)"
    if echo "$seed_response" | grep -q '"success":true'; then
      green "   Nutrition data seeded successfully."
    else
      yellow "   ⚠️  Nutrition seed response: $seed_response"
    fi

    # Create the admin user (bootstrap endpoint auto-verifies; no email needed)
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
        admin_password="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
      fi
      # Persist so future runs / volume resets reuse the same password.
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
      yellow "   ⚠️  Create-admin response: $register_response"
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
      yellow "⚠️  CHANGE POSTGRES_PASSWORD IN $ENV_FILE FOR PRODUCTION!"
    fi
  else
    green "   Setup already complete."
  fi
}

# ── Show status ──
show_status() {
  step "Container status:"
  cd "$PROJECT_ROOT"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
}

# ── Main ──
main() {
  echo ""
  green "╔═══════════════════════════════════════════════════════════════╗"
  green "║          PantryButler — Standalone Launcher                  ║"
  green "╚═══════════════════════════════════════════════════════════════╝"

  # Optional flags:
  #   --enable-admin-features   force admin features on (they default on)
  #   --noupdate                skip the git pull auto-update (local testing)
  #   --url <url>               public base URL for email links
  local no_update=0
  local cli_url=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --enable-admin-features) export ENABLE_ADMIN_FEATURES="true"; shift ;;
      --noupdate) no_update=1; shift ;;
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

  if [[ "${ENABLE_ADMIN_FEATURES:-true}" == "true" ]]; then
    yellow "ℹ️  Admin features ENABLED (Admin Instances / Admin Announcements — superadmin only)"
  else
    yellow "ℹ️  Admin features disabled. Set ENABLE_ADMIN_FEATURES=false to disable."
  fi

  start_containers
  run_setup
  show_status

  green ""
  green "✅ PantryButler is running at http://localhost:3000"
}

main "$@"
