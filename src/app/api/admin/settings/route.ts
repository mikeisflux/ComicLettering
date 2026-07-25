import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SETTING_KEYS, getSetting, setSetting } from "@/lib/settings";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const u = await getSessionUser();
  if (!u?.isAdmin) return null;
  return u;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const known = await Promise.all(SETTING_KEYS.map(async (def) => {
    const value = await getSetting(def.key);
    return {
      ...def,
      value: "secret" in def && def.secret && value ? "•••" + value.slice(-4) : value,
      set: !!value,
    };
  }));
  const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  const knownKeys = new Set<string>([...SETTING_KEYS.map((d) => d.key), "AUTH_SECRET"]);
  const custom = rows.filter((r) => !knownKeys.has(r.key)).map((r) => ({ key: r.key, value: r.value }));
  return NextResponse.json({ known, custom });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { key, value } = await req.json();
    if (!key || typeof value !== "string" || key === "AUTH_SECRET") {
      return NextResponse.json({ error: "invalid key/value" }, { status: 400 });
    }
    await setSetting(String(key).slice(0, 100), value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { key } = await req.json();
  if (!key || key === "AUTH_SECRET") return NextResponse.json({ error: "invalid key" }, { status: 400 });
  await prisma.setting.deleteMany({ where: { key: String(key) } });
  return NextResponse.json({ ok: true });
}
