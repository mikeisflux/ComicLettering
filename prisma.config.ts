/* Prisma 7 configuration. The connection string moved here from the schema
   (Prisma 7 no longer reads `url` in the datasource block, and no longer
   loads .env on its own — dotenv does that for the CLI; the app's runtime
   gets DATABASE_URL from PM2's ecosystem.config.js). */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    /* only migrate / db push / introspect need this; `prisma generate`
       (run by npm's postinstall on every machine) must work without it */
    url: process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset",
  },
  migrations: {
    seed: "node prisma/seed.mjs",
  },
});
