#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.2container"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

green()  { echo -e "\033[0;32m$*\033[0m"; }
yellow() { echo -e "\033[0;33m$*\033[0m"; }
red()    { echo -e "\033[0;31m$*\033[0m"; }
step()   { echo; green "▶  $*"; }

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
    rotate_db_password
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

  local setup_status
  setup_status="$(curl -sf http://localhost:3000/api/setup/status 2>/dev/null || echo '{"validation":{"hasUsers":false}}')"

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

    # Create the admin user
    step "Creating admin user..."
    local admin_email="${ADMIN_EMAIL:-admin@pantrybutler.local}"
    local admin_password="${ADMIN_PASSWORD:-admin123}"

    local register_response
    register_response="$(curl -sf -X POST http://localhost:3000/api/auth/register \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$admin_email\",\"password\":\"$admin_password\",\"instance_name\":\"My Kitchen\"}" 2>/dev/null || true)"

    if echo "$register_response" | grep -q '"token"'; then
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
    yellow "⚠️  CHANGE THE ADMIN PASSWORD AFTER FIRST LOGIN!"
    yellow "⚠️  CHANGE POSTGRES_PASSWORD IN $ENV_FILE FOR PRODUCTION!"
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

  # Optional --enable-admin-features switch (defaults to on)
  for arg in "$@"; do
    if [[ "$arg" == "--enable-admin-features" ]]; then
      export ENABLE_ADMIN_FEATURES="true"
    fi
  done

  check_prerequisites
  setup_env

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
