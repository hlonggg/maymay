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

    const withdrawals = await prisma.withdrawal.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { telegramId: true, username: true, firstName: true } },
        ledgerEntry: { select: { type: true, amount: true } },
      },
    });

    return NextResponse.json({
      withdrawals: withdrawals.map((item) => ({
        id: item.id,
        telegramId: item.user.telegramId,
        username: item.user.username ?? item.user.firstName,
        amount: item.amount.toFixed(0),
        status: item.status,
        payoutDetails: item.payoutDetails,
        hasReservedBalance: item.ledgerEntry?.type === "WITHDRAWAL_RESERVE" &&
          item.ledgerEntry.amount.eq(item.amount.negated()),
        createdAt: item.createdAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load admin withdrawals.", error);
    return NextResponse.json({ error: "Không thể tải danh sách yêu cầu rút tiền." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 8_000) {
    return NextResponse.json({ error: "Dữ liệu yêu cầu quá lớn." }, { status: 413 });
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
      !("id" in body) ||
      typeof body.id !== "string" ||
      !("status" in body) ||
      (body.status !== "APPROVED" && body.status !== "REJECTED")
    ) {
      return NextResponse.json({ error: "Thông tin yêu cầu rút tiền không hợp lệ." }, { status: 400 });
    }

    const withdrawalId = body.id;
    const requestedStatus = body.status;

    const updated = await prisma.$transaction(async (transaction) => {
      const withdrawal = await transaction.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: { ledgerEntry: true },
      });
      if (!withdrawal || withdrawal.status !== "PENDING") {
        throw new Error("WITHDRAWAL_NOT_PENDING");
      }

      const reserve = withdrawal.ledgerEntry;
      if (
        !reserve ||
        reserve.type !== "WITHDRAWAL_RESERVE" ||
        !reserve.amount.eq(withdrawal.amount.negated())
      ) {
        throw new Error("WITHDRAWAL_RESERVE_MISSING");
      }

      const changed = await transaction.withdrawal.updateMany({
        where: { id: withdrawal.id, status: "PENDING" },
        data: { status: requestedStatus, reviewedBy: actorId, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new Error("WITHDRAWAL_NOT_PENDING");

      if (requestedStatus === "REJECTED") {
        const user = await transaction.user.update({
          where: { id: withdrawal.userId },
          data: { balance: { increment: withdrawal.amount } },
          select: { balance: true },
        });
        await transaction.ledgerEntry.create({
          data: {
            userId: withdrawal.userId,
            type: "WITHDRAWAL_REFUND",
            amount: withdrawal.amount,
            balanceAfter: user.balance,
            note: `Hoàn tiền yêu cầu rút ${withdrawal.id}`,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorId,
          action: requestedStatus === "APPROVED" ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
          subjectId: withdrawal.id,
          metadata: { amount: withdrawal.amount.toFixed(0) },
        },
      });
      return { id: withdrawal.id, status: requestedStatus };
    });

    return NextResponse.json({ withdrawal: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "WITHDRAWAL_NOT_PENDING") {
      return NextResponse.json({ error: "Yêu cầu không còn ở trạng thái chờ duyệt." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "WITHDRAWAL_RESERVE_MISSING") {
      return NextResponse.json({
        error: "Không thể duyệt: yêu cầu chưa có bút toán giữ số dư hợp lệ.",
      }, { status: 409 });
    }
    console.error("Could not review admin withdrawal.", error);
    return NextResponse.json({ error: "Không thể cập nhật yêu cầu rút tiền." }, { status: 503 });
  }
}
