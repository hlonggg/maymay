import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

const SESSION_COOKIE = "maymay_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;
const CLOCK_SKEW_SECONDS = 30;

type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type SessionPayload = {
  telegramId: string;
  expiresAt: number;
};

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validateTelegramInitData(initData: string): TelegramWebAppUser {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_AUTH_NOT_CONFIGURED");
  if (initData.length === 0 || initData.length > 8192) {
    throw new Error("INVALID_INIT_DATA");
  }

  const params = new URLSearchParams(initData);
  const hashes = params.getAll("hash");
  const authDates = params.getAll("auth_date");
  const users = params.getAll("user");
  if (hashes.length !== 1 || authDates.length !== 1 || users.length !== 1) {
    throw new Error("INVALID_INIT_DATA");
  }

  const receivedHash = hashes[0];
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new Error("INVALID_INIT_DATA");
  }

  const authDate = Number(authDates[0]);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(authDate) ||
    authDate > now + CLOCK_SKEW_SECONDS ||
    now - authDate > INIT_DATA_MAX_AGE_SECONDS
  ) {
    throw new Error("EXPIRED_INIT_DATA");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  if (!safeEqual(calculatedHash, Buffer.from(receivedHash, "hex"))) {
    throw new Error("INVALID_INIT_DATA");
  }

  let user: unknown;
  try {
    user = JSON.parse(users[0]);
  } catch {
    throw new Error("INVALID_INIT_DATA");
  }

  if (
    typeof user !== "object" ||
    user === null ||
    !("id" in user) ||
    !(typeof user.id === "number" || (typeof user.id === "string" && /^\d+$/.test(user.id)))
  ) {
    throw new Error("INVALID_INIT_DATA");
  }

  const id = Number(user.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("INVALID_INIT_DATA");

  return {
    id,
    username: "username" in user && typeof user.username === "string" ? user.username : undefined,
    first_name:
      "first_name" in user && typeof user.first_name === "string" ? user.first_name : undefined,
    last_name:
      "last_name" in user && typeof user.last_name === "string" ? user.last_name : undefined,
  };
}

function signSessionPayload(payload: string): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSessionCookie(response: NextResponse, telegramId: string): void {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ telegramId, expiresAt } satisfies SessionPayload))
    .toString("base64url");
  const signature = signSessionPayload(payload);
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function readSessionTelegramId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!sessionCookie) return null;

  const value = sessionCookie.slice(SESSION_COOKIE.length + 1);
  if (value.length > 2048) return null;
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length !== 0) return null;

  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }

  let expectedSignature: Buffer;
  try {
    expectedSignature = Buffer.from(signSessionPayload(payload), "base64url");
  } catch {
    return null;
  }
  if (!safeEqual(receivedSignature, expectedSignature)) return null;

  let session: unknown;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof session !== "object" ||
    session === null ||
    !("telegramId" in session) ||
    typeof session.telegramId !== "string" ||
    !/^\d+$/.test(session.telegramId) ||
    !("expiresAt" in session) ||
    typeof session.expiresAt !== "number" ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return session.telegramId;
}

export function isAdminTelegramId(telegramId: string): boolean {
  return (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(telegramId);
}
