#!/bin/bash
# ============================================================================
# botblock-sync.sh  (LetterMyComic build)
#
# Full reconciliation: reads active blocked IPs from the app's PostgreSQL
# database and syncs them with the BOTBLOCK iptables chain — adds missing
# DROP rules, removes expired ones. Safety net behind botblock-watcher.
#
# Database credentials are read from DATABASE_URL (same one the app uses).
# The installer wraps this so DATABASE_URL comes from /opt/lettermycomic/.env.
#
# Cron (every 5 minutes):
#   */5 * * * * DATABASE_URL='postgresql://…' /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1
# ============================================================================

set -euo pipefail

CHAIN="BOTBLOCK"
LOG_PREFIX="[BotBlock-Sync]"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX Error: must run as root" >&2; exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "$LOG_PREFIX Error: DATABASE_URL is not set" >&2; exit 1
fi
if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
  log "DATABASE_URL is not PostgreSQL — nothing to sync."; exit 0
fi

# psql understands the connection URI directly; strip any query string it
# doesn't need (?schema=…). Keep it simple: pass the URI as-is to psql.
PSQL=(psql "$DATABASE_URL" -t -A)

# ---- 1. Ensure the BOTBLOCK chain exists and is hooked into INPUT ----
if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  log "Creating chain $CHAIN"; iptables -N "$CHAIN"
fi
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  log "Adding jump from INPUT to $CHAIN"; iptables -I INPUT -j "$CHAIN"
fi

# ---- 2. IPs that SHOULD be blocked (unexpired) ----
DB_IPS=$("${PSQL[@]}" -c "SELECT \"ipAddress\" FROM \"BlockedIP\" WHERE \"expiresAt\" > NOW();" 2>/dev/null) || {
  log "Error: failed to query database"; exit 1; }

declare -A DB_IP_SET
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && DB_IP_SET["$ip"]=1
done <<< "$DB_IPS"

# ---- 3. IPs currently in the chain ----
declare -A FW_IP_SET
while IFS= read -r line; do
  ip=$(echo "$line" | grep -oP '(?<=-s )[0-9.]+(?=/32)' 2>/dev/null) || continue
  [ -n "$ip" ] && FW_IP_SET["$ip"]=1
done < <(iptables -S "$CHAIN" 2>/dev/null)

# ---- 4. Add missing rules ----
added=0
for ip in "${!DB_IP_SET[@]}"; do
  if [ -z "${FW_IP_SET[$ip]+x}" ]; then
    iptables -A "$CHAIN" -s "$ip/32" -j DROP; log "ADDED $ip"; ((added++)) || true
  fi
done

# ---- 5. Remove expired rules (in firewall but not in DB) ----
removed=0
for ip in "${!FW_IP_SET[@]}"; do
  if [ -z "${DB_IP_SET[$ip]+x}" ]; then
    iptables -D "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null || true
    log "REMOVED $ip (expired)"; ((removed++)) || true
  fi
done

# ---- 6. Clean up very old expired rows ----
"${PSQL[@]}" -c "DELETE FROM \"BlockedIP\" WHERE \"expiresAt\" < NOW() - INTERVAL '7 days';" >/dev/null 2>&1 || true

# ---- 7. Summary ----
total=${#DB_IP_SET[@]}
if [ "$added" -gt 0 ] || [ "$removed" -gt 0 ]; then
  log "Sync complete: $total active blocks, +$added added, -$removed removed"
elif [ "$total" -gt 0 ]; then
  log "Sync complete: $total active blocks (no changes)"
fi
