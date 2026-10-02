/* Sentinel console — list, counts and bulk field updates (admin only). */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BUG_SEVERITIES as SEVERITIES, BUG_STATUSES as STATUSES } from "@/lib/bugs";

async function requireAdmin() {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const status = q.get("status") || "";
  const severity = q.get("severity") || "";
  const search = (q.get("q") || "").trim();
  const where = {
    ...(status === "active" ? { status: { in: ["open", "triaged", "in_progress"] } } : status ? { status } : {}),
    ...(severity ? { severity } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { build: { contains: search } },
        { id: { contains: search } },
      ],
    } : {}),
  };
  const [rows, counts] = await Promise.all([
    prisma.bugReport.findMany({
      where, orderBy: [{ createdAt: "desc" }], take: 300,
      select: {
        id: true, title: true, status: true, severity: true, email: true, name: true, form: true, build: true,
        url: true, createdAt: true, updatedAt: true, screenshot: false,
        _count: { select: { events: true } },
      },
    }),
    prisma.bugReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const tally: Record<string, number> = {};
  for (const c of counts) tally[c.status] = c._count._all;
  return NextResponse.json({ rows, tally });
}

/* change status / severity (one row) */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, status, severity } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: { status?: string; severity?: string; resolvedAt?: Date | null } = {};
  if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    data.status = status;
    data.resolvedAt = status === "fixed" || status === "closed" || status === "wontfix" ? new Date() : null;
  }
  if (severity) {
    if (!(SEVERITIES as readonly string[]).includes(severity)) return NextResponse.json({ error: "bad severity" }, { status: 400 });
    data.severity = severity;
  }
  const before = await prisma.bugReport.findUnique({ where: { id: String(id) }, select: { status: true, severity: true } });
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.bugReport.update({ where: { id: String(id) }, data });
  const changes: string[] = [];
  if (data.status && data.status !== before.status) changes.push(`status ${before.status} → ${data.status}`);
  if (data.severity && data.severity !== before.severity) changes.push(`severity ${before.severity} → ${data.severity}`);
  if (changes.length) {
    await prisma.bugEvent.create({ data: { bugId: String(id), kind: "status", author: admin.email, body: changes.join(", ") } });
  }
  return NextResponse.json({ ok: true });
}
