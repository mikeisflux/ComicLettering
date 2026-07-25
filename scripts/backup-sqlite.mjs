/*
 * Schema-agnostic complete backup of a SQLite database to JSON.
 * Reads EVERY user table and EVERY column dynamically — it makes no
 * assumptions about the schema, so anything added out-of-band (extra
 * columns, extra tables) is captured too.
 *
 *   SQLITE_PATH=prisma/dev.db node scripts/backup-sqlite.mjs > backup.json
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

const SQLITE_PATH = process.env.SQLITE_PATH || "prisma/dev.db";
if (!existsSync(SQLITE_PATH)) {
  process.stderr.write(`No SQLite database at ${SQLITE_PATH}.\n`);
  process.exit(1);
}

const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name")
  .all()
  .map((r) => r.name);

const out = { source: SQLITE_PATH, tables: {} };
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  out.tables[t] = { columns: cols, rowCount: rows.length, rows };
}

process.stdout.write(JSON.stringify(out, null, 2));
process.stderr.write(
  `Backed up ${tables.length} tables: ${tables.map((t) => `${t}(${out.tables[t].rowCount})`).join(", ")}\n`
);
db.close();
