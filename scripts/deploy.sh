#!/usr/bin/env bash
# LetterMyComic — build & deploy script.
#
#   First-time server setup:   sudo ./scripts/deploy.sh setup
#   Deploy latest code:        sudo ./scripts/deploy.sh
#   Tail app logs:             ./scripts/deploy.sh logs
#   Service status:            ./scripts/deploy.sh status
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

log()  { echo -e "\033[1;36m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

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
  if [ -f "$APP_DIR/prisma/dev.db" ]; then
    mkdir -p "$APP_DIR/backups"
    local stamp
    stamp=$(date +%Y%m%d-%H%M%S)
    cp "$APP_DIR/prisma/dev.db" "$APP_DIR/backups/dev-${stamp}.db"
    log "SQLite backup: backups/dev-${stamp}.db"
    # keep the 30 most recent backups
    ls -1t "$APP_DIR"/backups/dev-*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
  fi
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

  if [ ! -d "$APP_DIR/.git" ]; then
    log "Cloning $REPO_URL → $APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  cd "$APP_DIR"
  git checkout "$BRANCH"

  build_app

  log "Seeding database (superuser)…"
  if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
    SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" node prisma/seed.mjs
  else
    node prisma/seed.mjs
  fi

  log "Installing systemd service '${SERVICE}'…"
  cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=LetterMyComic (Next.js)
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v npm) start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$SERVICE"

  health_check || fail "App did not come up — check: journalctl -u ${SERVICE} -n 50"

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
  log "Logs:   journalctl -u ${SERVICE} -f"
}

cmd_deploy() {
  [ -d "$APP_DIR/.git" ] || fail "$APP_DIR is not a git checkout — run: sudo $0 setup"
  cd "$APP_DIR"

  local prev
  prev=$(git rev-parse HEAD)
  log "Current version: ${prev:0:10}"

  backup_db

  log "Pulling latest ${BRANCH}…"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  local next_rev
  next_rev=$(git rev-parse HEAD)
  if [ "$prev" = "$next_rev" ]; then
    log "Already up to date — rebuilding anyway."
  fi

  build_app

  log "Restarting ${SERVICE}…"
  systemctl restart "$SERVICE"

  if health_check; then
    log "Deployed ${next_rev:0:10} ✔"
    exit 0
  fi

  log "Health check FAILED — rolling back to ${prev:0:10}…"
  git reset --hard "$prev"
  build_app
  systemctl restart "$SERVICE"
  if health_check; then
    fail "Deploy failed; rolled back to previous version (now healthy). Check: journalctl -u ${SERVICE} -n 100"
  else
    fail "Deploy failed AND rollback is unhealthy — investigate: journalctl -u ${SERVICE} -n 100"
  fi
}

case "${1:-deploy}" in
  setup)  cmd_setup ;;
  deploy) cmd_deploy ;;
  logs)   journalctl -u "$SERVICE" -f ;;
  status) systemctl status "$SERVICE" --no-pager; curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:${PORT}/" ;;
  *) echo "Usage: $0 [setup|deploy|logs|status]"; exit 1 ;;
esac
