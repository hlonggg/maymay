import { NextResponse } from "next/server";
import { getAdminTelegramId } from "@/lib/admin-api";
import { hasSameOrigin } from "@/lib/request-origin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!(await getAdminTelegramId(request))) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80);
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { telegramId: { contains: search } },
              { username: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        balance: true,
        blockedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        balance: user.balance.toFixed(0),
        blockedAt: user.blockedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin user list.", error);
    return NextResponse.json({ error: "Không thể tải danh sách người dùng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 8_000) {
    return NextResponse.json({ error: "Dữ liệu tài khoản quá lớn." }, { status: 413 });
  }
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  try {
    const actorId = await getAdminTelegramId(request);
    if (!actorId) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("telegramId" in body) ||
      typeof body.telegramId !== "string" ||
      !/^\d+$/.test(body.telegramId) ||
      !("blocked" in body) ||
      typeof body.blocked !== "boolean"
    ) {
      return NextResponse.json({ error: "Thông tin tài khoản không hợp lệ." }, { status: 400 });
    }

    if (body.telegramId === actorId && body.blocked) {
      return NextResponse.json({ error: "Không thể tự khóa tài khoản quản trị." }, { status: 400 });
    }

    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { telegramId: body.telegramId },
        data: { blockedAt: body.blocked ? new Date() : null },
        select: { telegramId: true, blockedAt: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: body.blocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
          subjectId: updated.telegramId,
        },
      });
      return updated;
    });

    return NextResponse.json({
      user: { telegramId: user.telegramId, blockedAt: user.blockedAt?.toISOString() ?? null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not update admin user status.", error);
    return NextResponse.json({ error: "Không thể cập nhật trạng thái tài khoản." }, { status: 503 });
  }
}
