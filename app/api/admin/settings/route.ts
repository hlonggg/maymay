import { NextResponse } from "next/server";
import { getAdminTelegramId } from "@/lib/admin-api";
import { hasSameOrigin } from "@/lib/request-origin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const CALLBACK_REFERER_KEY = "callback_referer_domain";

export async function GET(request: Request) {
  try {
    if (!(await getAdminTelegramId(request))) {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }
    const setting = await prisma.appSetting.findUnique({
      where: { key: CALLBACK_REFERER_KEY },
      select: { value: true },
    });
    return NextResponse.json(
      { callbackRefererDomain: setting?.value ?? "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load callback referer setting.", error);
    return NextResponse.json({ error: "Không thể tải cấu hình callback." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 4_000) {
    return NextResponse.json({ error: "Dữ liệu cấu hình quá lớn." }, { status: 413 });
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
      !("callbackRefererDomain" in body) ||
      typeof body.callbackRefererDomain !== "string"
    ) {
      return NextResponse.json({ error: "Domain callback không hợp lệ." }, { status: 400 });
    }

    const inputs = body.callbackRefererDomain
      .split(/[;,\n]/)
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    const domains: string[] = [];
    for (const input of inputs) {
      if (input.length > 253 || /[/?#@:\s]/.test(input)) {
        return NextResponse.json({
          error: "Chỉ nhập hostname, ví dụ link4m.com; gtraffic.io; layma.net.",
        }, { status: 400 });
      }
      try {
        const parsed = new URL(`https://${input}`);
        if (
          parsed.hostname !== input ||
          parsed.hostname.length === 0 ||
          !parsed.hostname.includes(".") ||
          parsed.hostname === "localhost"
        ) {
          throw new Error("Invalid hostname");
        }
        if (!domains.includes(parsed.hostname)) domains.push(parsed.hostname);
      } catch {
        return NextResponse.json({ error: `Hostname callback không hợp lệ: ${input}` }, { status: 400 });
      }
    }
    const domain = domains.join(";");

    await prisma.$transaction(async (transaction) => {
      if (domain) {
        await transaction.appSetting.upsert({
          where: { key: CALLBACK_REFERER_KEY },
          create: { key: CALLBACK_REFERER_KEY, value: domain },
          update: { value: domain },
        });
      } else {
        await transaction.appSetting.deleteMany({ where: { key: CALLBACK_REFERER_KEY } });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: domain ? "CALLBACK_REFERER_DOMAIN_UPDATED" : "CALLBACK_REFERER_DOMAIN_CLEARED",
          metadata: { domain: domain || null },
        },
      });
    });

    return NextResponse.json(
      { callbackRefererDomain: domain },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not save callback referer setting.", error);
    return NextResponse.json({ error: "Không thể lưu cấu hình callback." }, { status: 503 });
  }
}
