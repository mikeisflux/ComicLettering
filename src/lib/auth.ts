/* Session auth: scrypt password hashing + HMAC-signed cookie tokens.
   Uses only node:crypto — no extra dependencies. */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { User } from "@prisma/client";

const scrypt = promisify(scryptCb) as (p: string, s: string, n: number) => Promise<Buffer>;
const COOKIE = "lmc_session";
const WEEK = 60 * 60 * 24 * 7;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64);
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = await scrypt(password, salt, 64);
  const other = Buffer.from(hash, "hex");
  return buf.length === other.length && timingSafeEqual(buf, other);
}

let cachedSecret: string | null = null;
async function authSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET) { cachedSecret = process.env.AUTH_SECRET; return cachedSecret; }
  const row = await prisma.setting.findUnique({ where: { key: "AUTH_SECRET" } });
  if (row?.value) { cachedSecret = row.value; return cachedSecret; }
  const secret = randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: "AUTH_SECRET" },
    update: {},
    create: { key: "AUTH_SECRET", value: secret },
  });
  cachedSecret = secret;
  return secret;
}

const b64u = (s: string) => Buffer.from(s).toString("base64url");

export async function signToken(uid: string): Promise<string> {
  const payload = b64u(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + WEEK }));
  const sig = createHmac("sha256", await authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string): Promise<string | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", await authSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || data.exp < Date.now() / 1000) return null;
    return data.uid;
  } catch { return null; }
}

export async function createSession(uid: string) {
  const token = await signToken(uid);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: WEEK,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const uid = await verifyToken(token);
    if (!uid) return null;
    return await prisma.user.findUnique({ where: { id: uid } });
  } catch { return null; }
}

export const hasAccess = (u: User | null) =>
  !!u && (u.isAdmin || u.subStatus === "active");
