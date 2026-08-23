#!/usr/bin/env bash
# ============================================================================
# PantryButler — macOS (and Linux) startup script
#
#   ./start-mac.sh                  First run: builds containers, starts,
#                                   seeds nutrition, and creates the admin.
#   ./start-mac.sh --reset-db       Optional: wipe the database volume and
#                                   restart fresh (destroys all data!).
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
  yellow "Production? Change POSTGRES_PASSWORD in docker/.env.2container and"
  yellow "restart (docker compose -p PantryButler up -d)."
}

run_setup() {
  step "Checking if setup is needed..."

  local setup_status
  setup_status="$(curl -sf http://localhost:3000/api/setup/status 2>/dev/null || echo '{"validation":{"hasUsers":false}}')"

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
    yellow "⚠️  CHANGE POSTGRES_PASSWORD IN docker/.env.2container FOR PRODUCTION!"
  else
    green "   Setup already complete."
  fi
}

main() {
  echo ""
  green "PantryButler — macOS startup"

  check_prerequisites

  for arg in "$@"; do
    case "$arg" in
      --reset-db) reset_db ;;
      --enable-admin-features) export ENABLE_ADMIN_FEATURES=true ;;
    esac
  done

  setup_env
  start_containers
  run_setup
  show_summary
}

main "$@"