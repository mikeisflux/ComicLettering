/*
 * BotBlock — app side of the kernel-level firewall.
 *
 * When abuse is detected, the app records it and (past a threshold) blocks
 * the IP: it upserts a BlockedIP row AND appends the IP to
 * /tmp/botblock-pending, which the root botblock-watcher picks up within ~5s
 * and drops at iptables. botblock-sync reconciles the firewall against the
 * BlockedIP table every few minutes as a safety net.
 *
 * Original firewall design: github.com/mikeisflux (helpfulapps/botblock-firewall).
 */
import { appendFile } from "fs/promises";
import { prisma } from "./db";

const PENDING_FILE = process.env.BOTBLOCK_PENDING || "/tmp/botblock-pending";
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/* Strict IPv4 check: shape AND octet range (rejects 999.1.1.1). */
function isValidIPv4(ip: string): boolean {
  if (!IPV4.test(ip)) return false;
  return ip.split(".").every((o) => +o <= 255);
}

/* Legitimate search-engine and social crawlers we must NEVER block —
   blocking these would remove the site from Google/Bing and break link
   previews on Facebook/X/etc. Matched against the User-Agent. */
const GOOD_BOTS =
  /(googlebot|google-inspectiontool|storebot-google|googleother|apis-google|adsbot-google|mediapartners-google|feedfetcher-google|google-site-verification|bingbot|bingpreview|msnbot|adidxbot|\bslurp\b|yahoo!\s*slurp|duckduckbot|facebookexternalhit|facebookcatalog|facebot|meta-externalagent|twitterbot|linkedinbot|applebot|yandex(bot)?|baiduspider|pinterest(bot)?|slackbot|telegrambot|whatsapp|discordbot)/i;

/* True for known-good crawlers (search engines + social link previews). */
export function isGoodBot(userAgent?: string | null): boolean {
  return !!userAgent && GOOD_BOTS.test(userAgent);
}

/* Client IP as seen behind the Caddy reverse proxy.
   SECURITY: Caddy APPENDS the real peer address to any inbound
   X-Forwarded-For, so the LAST entry is the one our own proxy wrote — the
   first entry is attacker-controlled and must never be trusted (it would let
   anyone spoof rate limits or firewall arbitrary IPs). */
export function clientIp(req: Request): string | null {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || null;
}

/* Append an IP to the pending file so the watcher drops it immediately.
   Best-effort: on platforms without the watcher this simply no-ops. */
async function notifyFirewall(ip: string) {
  try {
    await appendFile(PENDING_FILE, `${ip}\n`);
  } catch {
    /* pending file not writable (e.g. dev / no firewall) — DB block still stands */
  }
}

export interface BlockMeta {
  userAgent?: string | null;
  path?: string | null;
  actionId?: string | null;
}

/* Block an IP for `hours` (default 24). Idempotent: repeat blocks extend the
   window and bump the violation count. */
export async function blockIP(
  ip: string, reason: string, meta: BlockMeta = {}, hours = 24
): Promise<void> {
  if (!ip || !isValidIPv4(ip)) return; // only firewall real IPv4 addresses
  if (isGoodBot(meta.userAgent)) return; // never block Google/Bing/Yahoo/FB/X crawlers
  const expiresAt = new Date(Date.now() + hours * 3600_000);
  try {
    await prisma.blockedIP.upsert({
      where: { ipAddress: ip },
      update: {
        reason, expiresAt, violationCount: { increment: 1 },
        lastUserAgent: meta.userAgent ?? undefined,
        lastPath: meta.path ?? undefined,
        lastActionId: meta.actionId ?? undefined,
      },
      create: {
        ipAddress: ip, reason, expiresAt,
        lastUserAgent: meta.userAgent ?? null,
        lastPath: meta.path ?? null,
        lastActionId: meta.actionId ?? null,
      },
    });
  } catch {
    /* DB unavailable — still notify the firewall below */
  }
  await notifyFirewall(ip);
}

/* Is this IP currently blocked? (fast app-level check before the firewall
   catches up, and useful on hosts without the firewall.) */
export async function isBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  try {
    const row = await prisma.blockedIP.findUnique({ where: { ipAddress: ip } });
    return !!row && row.expiresAt.getTime() > Date.now();
  } catch {
    return false;
  }
}

/* Record a suspicious event. After `threshold` events from the same IP within
   `windowMin` minutes, the IP is auto-blocked. Returns true if it blocked. */
export async function noteSuspicious(
  ip: string | null, reason: string, meta: BlockMeta = {},
  threshold = 8, windowMin = 10
): Promise<boolean> {
  if (!ip) return false;
  if (isGoodBot(meta.userAgent)) return false; // don't track or escalate good crawlers
  try {
    await prisma.suspiciousActivity.create({
      data: {
        ipAddress: ip, reason,
        actionId: meta.actionId ?? null, path: meta.path ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
    const since = new Date(Date.now() - windowMin * 60_000);
    /* scope the threshold to THIS reason so unrelated signals (failed login
       + captcha + reset requests) don't pool into a premature block of a
       shared NAT/office IP */
    const count = await prisma.suspiciousActivity.count({
      where: { ipAddress: ip, reason, createdAt: { gte: since } },
    });
    if (count >= threshold) {
      await blockIP(ip, `Auto-block: ${count} suspicious events (${reason})`, meta);
      return true;
    }
  } catch {
    /* DB unavailable — ignore */
  }
  return false;
}
