import { NextResponse } from "next/server";
import { captchaSiteKey } from "@/lib/captcha";

/* Public: the reCAPTCHA v3 site key (null = captcha disabled, which is
   also the answer while only ONE of the two keys is configured). */
export async function GET() {
  return NextResponse.json({ siteKey: await captchaSiteKey() });
}
