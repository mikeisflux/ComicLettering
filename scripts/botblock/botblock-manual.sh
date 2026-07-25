#!/bin/bash
# ============================================================================
# botblock-manual.sh
#
# Command-line helper to manually block/unblock/list IPs.
#
# Usage:
#   sudo botblock-manual block 1.2.3.4
#   sudo botblock-manual unblock 1.2.3.4
#   sudo botblock-manual list
#   sudo botblock-manual flush
#   sudo botblock-manual count
# ============================================================================

set -uo pipefail

CHAIN="BOTBLOCK"

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: must run as root" >&2
  exit 1
fi

usage() {
  echo "Usage: $0 {block|unblock|list|flush|count} [IP]"
  echo ""
  echo "Commands:"
  echo "  block   <IP>   Block an IP immediately (adds iptables rule + pending file)"
  echo "  unblock <IP>   Remove an IP from the firewall"
  echo "  list           Show all currently blocked IPs"
  echo "  flush          Remove ALL blocked IPs"
  echo "  count          Show how many IPs are blocked"
  exit 1
}

# Ensure chain exists
ensure_chain() {
  if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
    iptables -N "$CHAIN"
    iptables -I INPUT -j "$CHAIN"
  fi
}

case "${1:-}" in
  block)
    ip="${2:-}"
    if [ -z "$ip" ]; then
      echo "Error: IP address required"
      echo "Usage: $0 block 1.2.3.4"
      exit 1
    fi

    if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Error: Invalid IP format: $ip"
      exit 1
    fi

    ensure_chain

    if iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
      echo "IP $ip is already blocked"
    else
      iptables -A "$CHAIN" -s "$ip/32" -j DROP
      echo "Blocked: $ip"
    fi

    # Also write to pending file (in case watcher picks it up for logging)
    echo "$ip" >> /tmp/botblock-pending 2>/dev/null || true
    ;;

  unblock)
    ip="${2:-}"
    if [ -z "$ip" ]; then
      echo "Error: IP address required"
      echo "Usage: $0 unblock 1.2.3.4"
      exit 1
    fi

    ensure_chain

    if iptables -D "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
      echo "Unblocked: $ip"
    else
      echo "IP $ip was not blocked"
    fi
    ;;

  list)
    ensure_chain

    echo "Currently blocked IPs in $CHAIN chain:"
    echo "----------------------------------------"
    iptables -S "$CHAIN" 2>/dev/null | grep -oP '(?<=-s )[0-9.]+(?=/32)' | sort || echo "(none)"
    ;;

  flush)
    ensure_chain

    count=$(iptables -S "$CHAIN" 2>/dev/null | grep -c '\-s' || echo 0)
    iptables -F "$CHAIN"
    echo "Flushed $count blocked IPs from $CHAIN chain"
    ;;

  count)
    ensure_chain

    count=$(iptables -S "$CHAIN" 2>/dev/null | grep -c '\-s' || echo 0)
    echo "$count IPs currently blocked"
    ;;

  *)
    usage
    ;;
esac
