#!/bin/bash
# ============================================================================
# botblock-watcher.sh
#
# Watches /tmp/botblock-pending for newly blocked IPs and immediately adds
# iptables DROP rules so the kernel drops packets before they reach your
# web server. Checks every 5 seconds.
#
# Your app just writes IPs to /tmp/botblock-pending (one per line).
# This script handles the rest.
#
# Install as systemd service:
#   sudo cp botblock-watcher.service /etc/systemd/system/
#   sudo systemctl enable --now botblock-watcher
#
# Or run directly:
#   sudo bash botblock-watcher.sh
# ============================================================================

set -uo pipefail

# ---- Configuration (edit these) ----
CHAIN="BOTBLOCK"                     # iptables chain name
PENDING_FILE="/tmp/botblock-pending" # File your app writes IPs to
INTERVAL=5                           # Seconds between checks
LOG_PREFIX="[BotBlock]"

# ---- Functions ----

log() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"
}

# ---- Startup checks ----

if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX Error: must run as root (needed for iptables)" >&2
  exit 1
fi

# Ensure the BOTBLOCK chain exists
if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  log "Creating iptables chain: $CHAIN"
  iptables -N "$CHAIN"
fi

# Ensure INPUT jumps to our chain (only add once)
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  log "Hooking $CHAIN into INPUT chain"
  iptables -I INPUT -j "$CHAIN"
fi

log "Watcher started — monitoring $PENDING_FILE every ${INTERVAL}s"

# ---- Main loop ----

while true; do
  # Check if pending file exists and has content
  if [ -s "$PENDING_FILE" ]; then
    # Atomically move the file so we don't lose writes during processing
    WORK_FILE="/tmp/botblock-processing.$$"
    mv "$PENDING_FILE" "$WORK_FILE" 2>/dev/null || { sleep "$INTERVAL"; continue; }

    # De-duplicate and process each IP
    sort -u "$WORK_FILE" | while IFS= read -r ip; do
      [ -z "$ip" ] && continue

      # Validate: must look like an IPv4 address
      if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log "SKIP invalid format: $ip"
        continue
      fi

      # Skip if rule already exists (no duplicates)
      if iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
        continue
      fi

      # Add the DROP rule — kernel will silently drop all packets from this IP
      iptables -A "$CHAIN" -s "$ip/32" -j DROP
      log "BLOCKED $ip"
    done

    rm -f "$WORK_FILE"
  fi

  sleep "$INTERVAL"
done
