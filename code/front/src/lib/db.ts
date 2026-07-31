import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Handle graceful shutdown
if (typeof global !== "undefined") {
  (global as any).onSIGTERM = () => {
    console.log("Received SIGTERM. Closing Prisma client.");
    prisma.$disconnect();
  };
  (global as any).onSignal = () => {
    console.log("Received signal. Closing Prisma client.");
    prisma.$disconnect();
  };
}
