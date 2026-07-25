#!/usr/bin/env bash
# LetterMyComic — build & deploy script (PM2).
#
#   First-time server setup:   sudo ./scripts/deploy.sh setup
#   Deploy latest code:        sudo ./scripts/deploy.sh          (zero-downtime)
#   Tail app logs:             ./scripts/deploy.sh logs
#   Service status:            ./scripts/deploy.sh status
#
# Deploys are zero-downtime: the app is built first while the running PM2
# cluster keeps serving, then `pm2 reload` swaps workers only once the new
# build binds the port. A build never takes the site down.
#
# Configuration can be overridden via environment variables:
#   APP_DIR=/opt/lettermycomic BRANCH=main DOMAIN=lettermycomic.com ./scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lettermycomic}"
REPO_URL="${REPO_URL:-https://github.com/mikeisflux/ComicLettering.git}"
BRANCH="${BRANCH:-claude/desktop-to-web-conversion-9as66e}"
SERVICE="${SERVICE:-lettermycomic}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-lettermycomic.com}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
DB_NAME="${DB_NAME:-comiclettering}"
DB_USER="${DB_USER:-comiclettering}"

log()  { echo -e "\033[1;36m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

ensure_pm2() {
  if ! command -v pm2 >/dev/null; then
    log "Installing PM2 globally…"
    npm install -g pm2 >/dev/null
  fi
}

# Export the app's .env (DATABASE_URL etc.) into this shell so prisma, the
# seed and the migration scripts can see it.
load_env() {
  if [ -f "$APP_DIR/.env" ]; then
    set -a; . "$APP_DIR/.env"; set +a
  fi
}

# Install PostgreSQL, ensure a role + database exist, and record the
# connection string in $APP_DIR/.env (generated once, then reused).
provision_postgres() {
  [ "$(id -u)" -eq 0 ] || fail "Provisioning PostgreSQL needs root (sudo)."
  if ! command -v psql >/dev/null; then
    log "Installing PostgreSQL…"
    apt-get install -y -qq postgresql postgresql-contrib >/dev/null
  fi
  systemctl enable --now postgresql >/dev/null 2>&1 || true

  touch "$APP_DIR/.env"
  if grep -qE '^DATABASE_URL="postgresql://' "$APP_DIR/.env"; then
    log "PostgreSQL DATABASE_URL already configured — reusing."
    return
  fi

  local pw
  pw=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  log "Creating PostgreSQL role & database (${DB_USER}/${DB_NAME})…"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${pw}';
  ELSE
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${pw}';
  END IF;
END \$\$;
SQL
  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    runuser -u postgres -- createdb -O "${DB_USER}" "${DB_NAME}"
  fi

  local url="postgresql://${DB_USER}:${pw}@localhost:5432/${DB_NAME}"
  if grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${url}\"|" "$APP_DIR/.env"
  else
    echo "DATABASE_URL=\"${url}\"" >> "$APP_DIR/.env"
  fi
  log "PostgreSQL ready."
}

# Copy any legacy SQLite data into PostgreSQL, then archive the old file so
# it never migrates twice. Idempotent (rows are upserted).
migrate_legacy_sqlite() {
  if [ -f "$APP_DIR/prisma/dev.db" ]; then
    log "Legacy SQLite database found — migrating its data into PostgreSQL…"
    ( cd "$APP_DIR" && SQLITE_PATH=prisma/dev.db node scripts/migrate-sqlite-to-postgres.mjs )
    mv "$APP_DIR/prisma/dev.db" "$APP_DIR/prisma/dev.db.migrated"
    log "Legacy SQLite archived to prisma/dev.db.migrated"
  fi
}

health_check() {
  log "Health check on http://localhost:${PORT} (up to ${HEALTH_TIMEOUT}s)…"
  for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -sf -o /dev/null "http://localhost:${PORT}/"; then
      log "Health check passed ✔"
      return 0
    fi
    sleep 1
  done
  return 1
}

build_app() {
  log "Installing dependencies (npm ci)…"
  npm ci --no-fund --no-audit
  log "Syncing database schema (prisma db push)…"
  npx prisma db push
  log "Building (next build)…"
  npm run build
}

backup_db() {
  mkdir -p "$APP_DIR/backups"
  local stamp
  stamp=$(date +%Y%m%d-%H%M%S)
  # legacy SQLite, if this server hasn't migrated yet: a byte-exact copy of
  # the file PLUS a schema-agnostic JSON dump of every table/column, so
  # nothing added out-of-band can be lost.
  if [ -f "$APP_DIR/prisma/dev.db" ]; then
    cp "$APP_DIR/prisma/dev.db" "$APP_DIR/backups/sqlite-${stamp}.db"
    ( cd "$APP_DIR" && SQLITE_PATH=prisma/dev.db node scripts/backup-sqlite.mjs \
        > "$APP_DIR/backups/sqlite-${stamp}.json" ) \
      && log "SQLite backup: backups/sqlite-${stamp}.db + .json (complete)" \
      || log "SQLite backup: backups/sqlite-${stamp}.db"
  fi
  # PostgreSQL dump
  if command -v pg_dump >/dev/null && [[ "${DATABASE_URL:-}" == postgresql://* ]]; then
    if pg_dump "$DATABASE_URL" > "$APP_DIR/backups/pg-${stamp}.sql" 2>/dev/null; then
      log "PostgreSQL backup: backups/pg-${stamp}.sql"
    else
      rm -f "$APP_DIR/backups/pg-${stamp}.sql"
    fi
    # keep the 30 most recent dumps
    ls -1t "$APP_DIR"/backups/pg-*.sql 2>/dev/null | tail -n +31 | xargs -r rm -f
  fi
}

# Start fresh, or reload in place if the app is already under PM2.
pm2_up() {
  ensure_pm2
  # migrate away from any old systemd unit so it can't fight for the port
  if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE}.service"; then
    log "Disabling old systemd service '${SERVICE}'…"
    systemctl disable --now "$SERVICE" 2>/dev/null || true
  fi
  cd "$APP_DIR"
  if pm2 describe "$SERVICE" >/dev/null 2>&1; then
    log "Reloading ${SERVICE} (zero-downtime)…"
    pm2 reload ecosystem.config.js --update-env
  else
    log "Starting ${SERVICE} under PM2…"
    pm2 start ecosystem.config.js --update-env
  fi
  pm2 save >/dev/null
}

cmd_setup() {
  [ "$(id -u)" -eq 0 ] || fail "Run setup as root (sudo)."

  log "Installing system packages…"
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates >/dev/null

  if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3 | tr -d .)" -lt 20 ]; then
    log "Installing Node.js 22…"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  log "Node $(node -v), npm $(npm -v)"
  ensure_pm2

  if [ ! -d "$APP_DIR/.git" ]; then
    log "Cloning $REPO_URL → $APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  cd "$APP_DIR"
  git checkout "$BRANCH"

  provision_postgres
  load_env

  build_app
  migrate_legacy_sqlite

  log "Seeding database (superuser)…"
  node prisma/seed.mjs

  pm2_up
  # start PM2 (and this app) automatically on server boot
  log "Enabling PM2 on boot…"
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  pm2 save >/dev/null

  health_check || fail "App did not come up — check: pm2 logs ${SERVICE}"

  if ! command -v caddy >/dev/null; then
    log "Installing Caddy (HTTPS reverse proxy)…"
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  if ! grep -q "$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
    log "Writing Caddyfile for ${DOMAIN}…"
    cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN}, www.${DOMAIN} {
    reverse_proxy localhost:${PORT}
}
EOF
    systemctl reload caddy || systemctl restart caddy
  fi

  log "Setup complete ✔  Point ${DOMAIN}'s DNS A record at this server."
  log "App:    http://localhost:${PORT}  (public via Caddy once DNS resolves)"
  log "Logs:   pm2 logs ${SERVICE}"
}

cmd_deploy() {
  [ -d "$APP_DIR/.git" ] || fail "$APP_DIR is not a git checkout — run: sudo $0 setup"
  cd "$APP_DIR"

  local prev
  prev=$(git rev-parse HEAD)
  log "Current version: ${prev:0:10}"

  log "Pulling latest ${BRANCH}…"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  local next_rev
  next_rev=$(git rev-parse HEAD)
  if [ "$prev" = "$next_rev" ]; then
    log "Already up to date — rebuilding anyway."
  fi

  provision_postgres   # installs PG + writes DATABASE_URL on the first run
  load_env
  backup_db            # dumps the current DB (and any legacy SQLite file)

  # Build first — the running PM2 cluster keeps serving the whole time.
  build_app            # includes `prisma db push` → creates PG tables
  migrate_legacy_sqlite # one-time: copy SQLite rows into PG, then archive it

  # Swap workers only now that the new build is ready.
  pm2_up

  if health_check; then
    log "Deployed ${next_rev:0:10} ✔  (zero-downtime reload)"
    exit 0
  fi

  log "Health check FAILED — rolling back to ${prev:0:10}…"
  git reset --hard "$prev"
  build_app
  pm2_up
  if health_check; then
    fail "Deploy failed; rolled back to previous version (now healthy). Check: pm2 logs ${SERVICE}"
  else
    fail "Deploy failed AND rollback is unhealthy — investigate: pm2 logs ${SERVICE}"
  fi
}

case "${1:-deploy}" in
  setup)  cmd_setup ;;
  deploy) cmd_deploy ;;
  logs)   ensure_pm2; pm2 logs "$SERVICE" ;;
  status) ensure_pm2; pm2 status; curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:${PORT}/" ;;
  *) echo "Usage: $0 [setup|deploy|logs|status]"; exit 1 ;;
esac
