import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export function GET() {
  return checkDatabase();
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      database: "connected",
      service: "maymay-mini-app",
    });
  } catch (error) {
    console.error("Health check could not connect to PostgreSQL.", error);
    return Response.json(
      { status: "error", database: "unavailable", service: "maymay-mini-app" },
      { status: 503 },
    );
  }
}
