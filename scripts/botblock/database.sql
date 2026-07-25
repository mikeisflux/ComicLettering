-- ============================================================================
-- BotBlock Firewall - PostgreSQL Schema (Optional)
--
-- Creates the tables needed for persistent IP blocking with expiration
-- and an audit trail of suspicious activity.
--
-- Usage:
--   PGPASSWORD='yourpass' psql -h localhost -U youruser -d yourdb -f database.sql
-- ============================================================================

-- Blocked IPs with expiration and violation tracking
CREATE TABLE IF NOT EXISTS "BlockedIP" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "ipAddress"       TEXT NOT NULL UNIQUE,
    "reason"          TEXT NOT NULL,
    "violationCount"  INTEGER NOT NULL DEFAULT 1,
    "blockedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"       TIMESTAMP(3) NOT NULL,

    -- Metadata for debugging
    "lastUserAgent"   TEXT,
    "lastPath"        TEXT,
    "lastActionId"    TEXT,

    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BlockedIP_ipAddress_idx" ON "BlockedIP"("ipAddress");
CREATE INDEX IF NOT EXISTS "BlockedIP_expiresAt_idx" ON "BlockedIP"("expiresAt");

-- Audit log of suspicious activity (for analysis and tuning thresholds)
CREATE TABLE IF NOT EXISTS "SuspiciousActivity" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "ipAddress"       TEXT NOT NULL,
    "reason"          TEXT NOT NULL,
    "actionId"        TEXT,
    "path"            TEXT,
    "userAgent"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SuspiciousActivity_ipAddress_idx" ON "SuspiciousActivity"("ipAddress");
CREATE INDEX IF NOT EXISTS "SuspiciousActivity_createdAt_idx" ON "SuspiciousActivity"("createdAt");

-- ============================================================================
-- Helper: generate CUID-like IDs (if you don't have a CUID generator)
-- You can replace this with uuid_generate_v4() if you prefer UUIDs.
-- ============================================================================

-- Example insert:
-- INSERT INTO "BlockedIP" ("id", "ipAddress", "reason", "expiresAt", "updatedAt")
-- VALUES (
--   'blk_' || substr(md5(random()::text), 1, 24),
--   '1.2.3.4',
--   'Bot detected - invalid server action',
--   NOW() + INTERVAL '24 hours',
--   NOW()
-- );
