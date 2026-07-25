# BotBlock Firewall

**Instant kernel-level IP blocking for web applications.**

When your app detects a bot or abusive IP, BotBlock drops it at the Linux firewall (iptables) within seconds — so the traffic never reaches your web server again.

## The Problem

Most web apps block bots at the application level (returning 403s). But the bot keeps hammering your server with hundreds of requests that your app still has to process. Your Node.js/Python/PHP process wastes CPU on traffic that should never arrive.

## The Solution

BotBlock uses a two-layer approach:

1. **Your app** writes bad IPs to `/tmp/botblock-pending` (one IP per line)
2. **botblock-watcher** (runs as root) checks that file every 5 seconds and adds `iptables DROP` rules
3. **botblock-sync** (cron, every 5 minutes) does a full reconciliation against your database as a safety net

Once an IP hits the firewall, the Linux kernel drops packets before they reach your web server. Zero CPU wasted.

## Quick Start

### 1. Install the watcher service

```bash
# Copy files to your server
sudo cp botblock-watcher.sh /usr/local/bin/botblock-watcher
sudo chmod +x /usr/local/bin/botblock-watcher

# Install systemd service
sudo cp botblock-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now botblock-watcher

# Verify it's running
sudo systemctl status botblock-watcher
```

### 2. (Optional) Install the database sync cron

If you store blocked IPs in a PostgreSQL database, the sync script provides a safety net that reconciles iptables with your database every 5 minutes.

```bash
sudo cp botblock-sync.sh /usr/local/bin/botblock-sync
sudo chmod +x /usr/local/bin/botblock-sync

# Edit the script to set your database credentials
sudo nano /usr/local/bin/botblock-sync

# Add to crontab
sudo crontab -e
# Add this line:
# */5 * * * * /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1
```

### 3. Write IPs from your app

From your application code, just append the IP to `/tmp/botblock-pending`:

**Node.js / TypeScript:**
```typescript
import { appendFile } from "fs/promises";

async function blockIP(ip: string) {
  // Save to your database first (your existing logic)
  await saveBlockedIP(ip);

  // Then notify the firewall watcher
  await appendFile("/tmp/botblock-pending", `${ip}\n`);
}
```

**Python:**
```python
def block_ip(ip: str):
    # Save to your database first
    save_blocked_ip(ip)

    # Then notify the firewall watcher
    with open("/tmp/botblock-pending", "a") as f:
        f.write(f"{ip}\n")
```

**PHP:**
```php
function blockIP(string $ip): void {
    // Save to your database first
    saveBlockedIP($ip);

    // Then notify the firewall watcher
    file_put_contents("/tmp/botblock-pending", "$ip\n", FILE_APPEND | LOCK_EX);
}
```

**Ruby:**
```ruby
def block_ip(ip)
  # Save to your database first
  save_blocked_ip(ip)

  # Then notify the firewall watcher
  File.open("/tmp/botblock-pending", "a") { |f| f.puts(ip) }
end
```

**Go:**
```go
func blockIP(ip string) error {
    // Save to your database first
    if err := saveBlockedIP(ip); err != nil {
        return err
    }

    // Then notify the firewall watcher
    f, err := os.OpenFile("/tmp/botblock-pending", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return err
    }
    defer f.Close()
    _, err = f.WriteString(ip + "\n")
    return err
}
```

**Shell / curl:**
```bash
# Block an IP immediately
echo "1.2.3.4" >> /tmp/botblock-pending
```

## How It Works

```
[Your App] ---> writes IP to /tmp/botblock-pending
                        |
                        v
[botblock-watcher]  (every 5s, runs as root)
  1. Atomically moves pending file to avoid race conditions
  2. Validates each IP (rejects malformed entries)
  3. Checks if iptables rule already exists (no duplicates)
  4. Adds: iptables -A BOTBLOCK -s <ip>/32 -j DROP
                        |
                        v
[Linux Kernel]  drops all packets from that IP
                Node/Python/PHP never sees them again
```

## Architecture

```
                    ┌─────────────────────┐
                    │    Incoming Traffic  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      iptables       │
                    │  INPUT -> BOTBLOCK  │
                    │                     │
                    │  If IP in BOTBLOCK: │
                    │     DROP (silent)   │
                    └──────────┬──────────┘
                               │ (only clean traffic)
                    ┌──────────▼──────────┐
                    │   Your Web Server   │
                    │  (nginx/Node/etc)   │
                    │                     │
                    │  Detects bot? ──────┼──> /tmp/botblock-pending
                    └─────────────────────┘            │
                                                       │
                    ┌──────────────────────┐           │
                    │  botblock-watcher    │◄──────────┘
                    │  (systemd service)   │
                    │  Reads pending file  │
                    │  Adds iptables rules │
                    └──────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `botblock-watcher.sh` | Main service — watches pending file, applies iptables rules (every 5s) |
| `botblock-watcher.service` | Systemd unit file for the watcher |
| `botblock-sync.sh` | Optional cron script — syncs iptables with PostgreSQL database |
| `database.sql` | Optional PostgreSQL schema for persistent storage |
| `botblock-manual.sh` | Manual helper — block/unblock/list IPs from the command line |

## Manual IP Management

```bash
# Block an IP immediately (via pending file)
sudo botblock-manual block 1.2.3.4

# Unblock an IP
sudo botblock-manual unblock 1.2.3.4

# List all currently blocked IPs
sudo botblock-manual list

# Flush all blocks (unblock everything)
sudo botblock-manual flush
```

## Database Schema (Optional)

If you want persistent storage with expiration and audit trails, apply the included SQL:

```bash
PGPASSWORD='yourpass' psql -h localhost -U youruser -d yourdb -f database.sql
```

This creates:
- `BlockedIP` — currently blocked IPs with expiration and violation count
- `SuspiciousActivity` — audit log of all detected suspicious behavior

## Configuration

Edit the variables at the top of each script:

### botblock-watcher.sh
| Variable | Default | Description |
|----------|---------|-------------|
| `CHAIN` | `BOTBLOCK` | iptables chain name |
| `PENDING_FILE` | `/tmp/botblock-pending` | File your app writes IPs to |
| `INTERVAL` | `5` | Seconds between checks |

### botblock-sync.sh
| Variable | Default | Description |
|----------|---------|-------------|
| `CHAIN` | `BOTBLOCK` | iptables chain name |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_USER` | `youruser` | PostgreSQL user |
| `DB_PASS` | `yourpass` | PostgreSQL password |
| `DB_NAME` | `yourdb` | PostgreSQL database |

## Requirements

- Linux with iptables (most VPS/dedicated servers)
- Root access (for iptables)
- systemd (for the watcher service)
- PostgreSQL (optional, for the sync script)

## Uninstall

```bash
# Stop and remove the service
sudo systemctl stop botblock-watcher
sudo systemctl disable botblock-watcher
sudo rm /etc/systemd/system/botblock-watcher.service
sudo systemctl daemon-reload

# Remove iptables rules
sudo iptables -D INPUT -j BOTBLOCK 2>/dev/null
sudo iptables -F BOTBLOCK 2>/dev/null
sudo iptables -X BOTBLOCK 2>/dev/null

# Remove scripts
sudo rm /usr/local/bin/botblock-watcher
sudo rm /usr/local/bin/botblock-sync    # if installed
sudo rm /usr/local/bin/botblock-manual  # if installed

# Remove pending file
rm -f /tmp/botblock-pending
```

## License

MIT — free to use, modify, and distribute.

## Credits

Built by the [IndieCrowdfund](https://indiecrowdfund.com) team after getting hammered by bots one too many times.
