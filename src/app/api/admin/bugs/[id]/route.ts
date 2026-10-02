/* One bug report: detail with its timeline, notes/replies, delete. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/sendgrid";
import { siteUrl } from "@/lib/settings";

async function requireAdmin() {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const bug = await prisma.bugReport.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(bug);
}

/* add a note (internal) or a reply (emailed to the reporter, logged) */
export async function POST(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { kind, body } = await req.json();
  const text = String(body || "").trim().slice(0, 20000);
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  const bug = await prisma.bugReport.findUnique({ where: { id }, select: { email: true, title: true, status: true } });
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (kind === "reply") {
    if (!bug.email) return NextResponse.json({ error: "This report has no email address to reply to." }, { status: 400 });
    const site = await siteUrl();
    const r = await sendMail({
      to: bug.email,
      subject: `Re: your LetterMyComic bug report — ${bug.title}`.slice(0, 200),
      text: `${text}\n\n—\nYou reported: "${bug.title}" (report ${id.slice(-8)}).\nReply to this email to add to the thread.\n${site}`,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  } else if (kind !== "note") {
    return NextResponse.json({ error: "bad kind" }, { status: 400 });
  }
  const ev = await prisma.bugEvent.create({ data: { bugId: id, kind, author: admin.email, body: text } });
  return NextResponse.json({ ok: true, event: ev });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.bugReport.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
