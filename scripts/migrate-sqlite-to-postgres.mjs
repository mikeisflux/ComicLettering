/*
 * One-time data migration: copy every row from the old SQLite database into
 * the current (PostgreSQL) database via Prisma.
 *
 *   SQLITE_PATH=prisma/dev.db DATABASE_URL="postgresql://…" \
 *     node scripts/migrate-sqlite-to-postgres.mjs
 *
 * Safe to re-run: rows are upserted by primary key, so an interrupted or
 * repeated migration converges instead of duplicating. Reads are done with
 * Node's built-in SQLite (no extra dependency); writes use the generated
 * Prisma client, which is now pointed at PostgreSQL.
 */
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";

const SQLITE_PATH = process.env.SQLITE_PATH || "prisma/dev.db";
if (!existsSync(SQLITE_PATH)) {
  console.log(`No SQLite database at ${SQLITE_PATH} — nothing to migrate.`);
  process.exit(0);
}

const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const prisma = new PrismaClient();

const bool = (v) => v === 1 || v === true || v === "1";
const date = (v) => (v == null ? undefined : new Date(v));

const rows = (table) => {
  try {
    return sqlite.prepare(`SELECT * FROM "${table}"`).all();
  } catch {
    return []; // table absent in the old DB
  }
};

/* Columns this migrator copies for each table. Used to reconcile against the
   ACTUAL SQLite schema so anything added out-of-band is reported, not lost. */
const HANDLED = {
  User: ["id", "email", "name", "passwordHash", "isAdmin", "subStatus", "subPlan", "subId", "createdAt", "updatedAt"],
  Setting: ["key", "value", "updatedAt"],
  Project: ["id", "name", "data", "thumbnail", "userId", "createdAt", "updatedAt"],
  UserAsset: ["id", "userId", "kind", "name", "data", "createdAt"],
  Message: ["id", "direction", "channel", "fromEmail", "fromName", "toEmail", "subject", "body", "read", "threadId", "createdAt"],
};

/* Compare what's really in the SQLite file against what we know how to move.
   Returns true if everything is covered, false (with warnings) otherwise. */
function reconcileSchema() {
  const actualTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
    .all().map((r) => r.name);
  let clean = true;
  for (const t of actualTables) {
    const cols = sqlite.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
    if (!HANDLED[t]) {
      const n = sqlite.prepare(`SELECT count(*) c FROM "${t}"`).get().c;
      console.warn(`⚠ SQLite table "${t}" (${n} rows) is NOT in the Prisma schema — its data is safe in the backup but was NOT migrated. Add it to prisma/schema.prisma and re-run.`);
      clean = false;
      continue;
    }
    const extra = cols.filter((c) => !HANDLED[t].includes(c));
    if (extra.length) {
      console.warn(`⚠ SQLite table "${t}" has extra column(s) [${extra.join(", ")}] not in the Prisma schema — those values were NOT migrated (data is in the backup).`);
      clean = false;
    }
  }
  return clean;
}

async function run() {
  console.log(`Migrating ${SQLITE_PATH} → PostgreSQL…`);
  const schemaClean = reconcileSchema();

  let total = 0;
  // sqlite user id -> effective Postgres user id (they differ when a user
  // with the same email already exists in Postgres, e.g. a seeded superuser)
  const userIdMap = new Map();

  for (const u of rows("User")) {
    const byId = await prisma.user.findUnique({ where: { id: u.id } });
    const byEmail = byId ? null : await prisma.user.findUnique({ where: { email: u.email } });
    if (byEmail) {
      // keep the existing Postgres row; just remap references to it
      userIdMap.set(u.id, byEmail.id);
      continue;
    }
    userIdMap.set(u.id, u.id);
    if (byId) continue; // already migrated
    await prisma.user.create({
      data: {
        id: u.id, email: u.email, name: u.name, passwordHash: u.passwordHash,
        isAdmin: bool(u.isAdmin), subStatus: u.subStatus ?? "none",
        subPlan: u.subPlan ?? null, subId: u.subId ?? null,
        createdAt: date(u.createdAt), updatedAt: date(u.updatedAt),
      },
    });
    total++;
  }
  const mapUser = (id) => (id == null ? null : userIdMap.get(id) ?? id);

  for (const s of rows("Setting")) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value, updatedAt: date(s.updatedAt) },
    });
    total++;
  }

  for (const p of rows("Project")) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, name: p.name, data: p.data, thumbnail: p.thumbnail ?? null,
        userId: mapUser(p.userId),
        createdAt: date(p.createdAt), updatedAt: date(p.updatedAt),
      },
    });
    total++;
  }

  for (const a of rows("UserAsset")) {
    const uid = mapUser(a.userId);
    if (!uid) continue; // orphaned asset — its user didn't migrate
    await prisma.userAsset.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, userId: uid, kind: a.kind, name: a.name, data: a.data,
        createdAt: date(a.createdAt),
      },
    });
    total++;
  }

  for (const m of rows("Message")) {
    await prisma.message.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id, direction: m.direction, channel: m.channel,
        fromEmail: m.fromEmail, fromName: m.fromName ?? null,
        toEmail: m.toEmail ?? null, subject: m.subject, body: m.body,
        read: bool(m.read), threadId: m.threadId ?? null,
        createdAt: date(m.createdAt),
      },
    });
    total++;
  }

  /* reconcile row counts: every SQLite row of a handled table must exist in
     Postgres (users are counted by the ids they mapped to) */
  const counts = {
    User: await prisma.user.count(),
    Setting: await prisma.setting.count(),
    Project: await prisma.project.count(),
    UserAsset: await prisma.userAsset.count(),
    Message: await prisma.message.count(),
  };
  let mismatch = false;
  for (const t of Object.keys(HANDLED)) {
    const src = rows(t).length;
    const dst = counts[t];
    const ok = dst >= src;
    if (!ok) mismatch = true;
    console.log(`  ${ok ? "✓" : "✗"} ${t}: sqlite ${src} → postgres ${dst}`);
  }

  console.log(`✔ Migrated ${total} rows from ${SQLITE_PATH} into PostgreSQL.`);
  if (mismatch)
    throw new Error("Row-count check failed: Postgres has fewer rows than SQLite for a handled table. NOT safe to decommission SQLite — investigate.");
  if (!schemaClean && process.env.ALLOW_PARTIAL_MIGRATION !== "1")
    throw new Error(
      "SQLite contains tables/columns the Prisma schema does not cover (see ⚠ above). " +
      "They are preserved in the backup but were NOT migrated. Update prisma/schema.prisma to include them, then re-deploy. " +
      "To migrate everything else and proceed anyway, set ALLOW_PARTIAL_MIGRATION=1.");
}

run()
  .catch((e) => { console.error("Migration failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); sqlite.close(); });
