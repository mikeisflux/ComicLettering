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

async function run() {
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

  console.log(`✔ Migrated ${total} rows from ${SQLITE_PATH} into PostgreSQL.`);
}

run()
  .catch((e) => { console.error("Migration failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); sqlite.close(); });
