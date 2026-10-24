// Prisma CLI configuration (Prisma 7). The app itself connects through the pg adapter (see src/prisma).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection. Neon: DIRECT_URL is the URL without "-pooler".
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
