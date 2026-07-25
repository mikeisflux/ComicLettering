import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/sendgrid";

async function requireAdmin() {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const messages = await prisma.message.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(messages);
}

/* mark read / unread */
export async function PUT(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, read } = await req.json();
  await prisma.message.update({ where: { id: String(id) }, data: { read: !!read } });
  return NextResponse.json({ ok: true });
}

/* reply to a message (sends via SendGrid, stores outbound copy) */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { threadId, to, subject, body } = await req.json();
    if (!to || !body) return NextResponse.json({ error: "to and body are required" }, { status: 400 });
    const result = await sendMail({ to: String(to), subject: String(subject || "Re: your message"), text: String(body) });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    await prisma.message.create({
      data: {
        direction: "out",
        channel: "reply",
        fromEmail: "site",
        toEmail: String(to),
        subject: String(subject || "Re: your message"),
        body: String(body),
        read: true,
        threadId: threadId ? String(threadId) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.message.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true });
}
