/* Seeds the site superuser: admin + lifetime pro access.
   Password comes from SEED_ADMIN_PASSWORD, or is generated and printed once. */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();
const EMAIL = "divinitycomicsinc@gmail.com";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
if (existing) {
  await prisma.user.update({
    where: { email: EMAIL },
    data: { isAdmin: true, subStatus: "active", subPlan: "lifetime" },
  });
  console.log(`✔ ${EMAIL} already exists — ensured admin + lifetime access.`);
} else {
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Divinity Comics",
      passwordHash: hashPassword(password),
      isAdmin: true,
      subStatus: "active",
      subPlan: "lifetime",
    },
  });
  console.log(`✔ Created superuser ${EMAIL} (admin, lifetime pro).`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  Generated password: ${password}`);
    console.log("  ⚠ Save this now — it is not shown again. Set SEED_ADMIN_PASSWORD to choose your own.");
  }
}
await prisma.$disconnect();
