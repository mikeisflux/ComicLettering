/* Collaboration for one book: team, pinned page comments, review passes.
   GET returns the whole picture for the signed-in member; POST performs an
   action, dispatched on `op`. Every op re-checks the caller's role — the
   client UI only decides what to SHOW. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canEdit, projectRole } from "@/lib/collab";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const role = await projectRole(id, user.id);
  if (!role) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [project, shares, comments, reviews] = await Promise.all([
    prisma.project.findUnique({ where: { id }, select: { name: true, user: { select: { name: true, email: true } } } }),
    prisma.projectShare.findMany({
      where: { projectId: id },
      select: { id: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pageComment.findMany({
      where: { projectId: id },
      select: {
        id: true, pageIndex: true, x: true, y: true, body: true, resolved: true,
        createdAt: true, authorId: true, author: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reviewPass.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return NextResponse.json({
    role,
    me: user.id,
    owner: project?.user ? { name: project.user.name, email: project.user.email } : null,
    shares: shares.map((s) => ({ id: s.id, role: s.role, name: s.user.name, email: s.user.email })),
    comments,
    reviews,
  });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const role = await projectRole(id, user.id);
  if (!role) return NextResponse.json({ error: "not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const op = String(body.op || "");

  try {
    /* ---- sharing (owner only) ---- */
    if (op === "share") {
      if (role !== "owner") return NextResponse.json({ error: "Only the owner can share the book." }, { status: 403 });
      const email = String(body.email || "").trim().toLowerCase();
      const shareRole = body.role === "editor" ? "editor" : "letterer";
      if (!email) return NextResponse.json({ error: "An email is required." }, { status: 400 });
      const invitee = await prisma.user.findUnique({ where: { email } });
      if (!invitee) return NextResponse.json({ error: "No LetterMyComic account uses that email — they need to sign up first." }, { status: 404 });
      if (invitee.id === user.id) return NextResponse.json({ error: "That is your own account." }, { status: 400 });
      await prisma.projectShare.upsert({
        where: { projectId_userId: { projectId: id, userId: invitee.id } },
        create: { projectId: id, userId: invitee.id, role: shareRole },
        update: { role: shareRole },
      });
      return NextResponse.json({ ok: true });
    }
    if (op === "unshare") {
      if (role !== "owner") return NextResponse.json({ error: "Only the owner can manage the team." }, { status: 403 });
      await prisma.projectShare.deleteMany({ where: { id: String(body.shareId || ""), projectId: id } });
      return NextResponse.json({ ok: true });
    }

    /* ---- comments (any member) ---- */
    if (op === "comment") {
      const text = String(body.body || "").trim().slice(0, 2000);
      const pageIndex = Number(body.pageIndex);
      const x = Number(body.x), y = Number(body.y);
      if (!text || !Number.isFinite(pageIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
        return NextResponse.json({ error: "bad comment" }, { status: 400 });
      }
      const c = await prisma.pageComment.create({
        data: { projectId: id, authorId: user.id, pageIndex: Math.max(0, Math.round(pageIndex)), x, y, body: text },
      });
      return NextResponse.json({ ok: true, id: c.id });
    }
    if (op === "resolve") {
      await prisma.pageComment.updateMany({
        where: { id: String(body.commentId || ""), projectId: id },
        data: { resolved: body.resolved !== false },
      });
      return NextResponse.json({ ok: true });
    }
    if (op === "uncomment") {
      const c = await prisma.pageComment.findFirst({ where: { id: String(body.commentId || ""), projectId: id } });
      if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (c.authorId !== user.id && role !== "owner") {
        return NextResponse.json({ error: "Only the author or the owner can delete a comment." }, { status: 403 });
      }
      await prisma.pageComment.delete({ where: { id: c.id } });
      return NextResponse.json({ ok: true });
    }

    /* ---- review passes ---- */
    if (op === "review") {
      /* letterer or owner asks for a pass */
      if (!canEdit(role)) return NextResponse.json({ error: "Only the letterer or owner can request review." }, { status: 403 });
      const open = await prisma.reviewPass.findFirst({ where: { projectId: id, status: "open" } });
      if (open) return NextResponse.json({ error: "A review pass is already open." }, { status: 409 });
      await prisma.reviewPass.create({
        data: { projectId: id, requestedBy: user.id, note: String(body.note || "").slice(0, 1000) || null },
      });
      return NextResponse.json({ ok: true });
    }
    if (op === "close") {
      /* editor or owner closes the open pass */
      if (role === "letterer") return NextResponse.json({ error: "Review passes are closed by the editor or owner." }, { status: 403 });
      const status = body.status === "approved" ? "approved" : "changes";
      const open = await prisma.reviewPass.findFirst({ where: { projectId: id, status: "open" } });
      if (!open) return NextResponse.json({ error: "No open review pass." }, { status: 404 });
      await prisma.reviewPass.update({
        where: { id: open.id },
        data: { status, closedBy: user.id, closedAt: new Date(), note: String(body.note || "").slice(0, 1000) || open.note },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}
