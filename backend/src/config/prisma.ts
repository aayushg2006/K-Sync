import { Prisma, PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const prismaClientOptions: Prisma.PrismaClientOptions =
  process.env.NODE_ENV === "development"
    ? {
        log: ["query", "info", "warn", "error"],
      }
    : {
        log: ["warn", "error"],
      };

const prisma = prismaGlobal.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}

export default prisma;
export { prisma };
