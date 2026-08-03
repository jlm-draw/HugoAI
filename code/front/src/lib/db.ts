import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  onSIGTERM?: () => void;
  onSignal?: () => void;
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
  globalForPrisma.onSIGTERM = () => {
    console.log("Received SIGTERM. Closing Prisma client.");
    prisma.$disconnect();
  };
  globalForPrisma.onSignal = () => {
    console.log("Received signal. Closing Prisma client.");
    prisma.$disconnect();
  };
}
