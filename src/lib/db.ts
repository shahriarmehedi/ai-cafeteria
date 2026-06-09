import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const isDbConfigured = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (url.includes("username:password") || url.includes("cluster.xxxx")) {
    return false;
  }
  return true;
};

export const isPrismaActive = isDbConfigured();

export const prisma = globalThis.prisma || (isPrismaActive ? new PrismaClient() : null);

if (process.env.NODE_ENV !== "production" && isPrismaActive) {
  globalThis.prisma = prisma as PrismaClient;
}
