import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* SendGrid Inbound Parse webhook — set your domain's MX to mx.sendgrid.net
   and point the Inbound Parse URL at /api/inbound-email. Every email sent to
   the site lands in the internal admin inbox. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const from = String(form.get("from") || "");
    const emailMatch = from.match(/<([^>]+)>/);
    await prisma.message.create({
      data: {
        direction: "in",
        channel: "email",
        fromEmail: (emailMatch ? emailMatch[1] : from).slice(0, 200),
        fromName: from.replace(/<[^>]+>/, "").trim().slice(0, 120) || null,
        toEmail: String(form.get("to") || "").slice(0, 200),
        subject: String(form.get("subject") || "(no subject)").slice(0, 250),
        body: String(form.get("text") || form.get("html") || "").slice(0, 100000),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
