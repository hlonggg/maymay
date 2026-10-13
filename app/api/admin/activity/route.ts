import { NextResponse } from "next/server";
import { getAdminTelegramId } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!(await getAdminTelegramId(request))) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const entries = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, actorId: true, action: true, subjectId: true, metadata: true, createdAt: true },
    });
    return NextResponse.json({
      activity: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin activity log.", error);
    return NextResponse.json({ error: "Không thể tải nhật ký quản trị." }, { status: 503 });
  }
}
