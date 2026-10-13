type TurnstileSiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

function isTurnstileResponse(value: unknown): value is TurnstileSiteverifyResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean" &&
    (!("action" in value) || typeof value.action === "string") &&
    (!("hostname" in value) || typeof value.hostname === "string")
  );
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return Response.json(
      { error: "Captcha chưa được cấu hình trên máy chủ." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string" ||
    body.token.length === 0 ||
    body.token.length > 2048
  ) {
    return Response.json({ error: "Captcha token không hợp lệ." }, { status: 400 });
  }

  const form = new URLSearchParams({
    secret,
    response: body.token,
  });

  let siteverifyResponse: Response;
  try {
    siteverifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
  } catch {
    return Response.json(
      { error: "Không thể kết nối dịch vụ captcha. Vui lòng thử lại." },
      { status: 502 },
    );
  }

  if (!siteverifyResponse.ok) {
    return Response.json(
      { error: "Dịch vụ captcha tạm thời không khả dụng." },
      { status: 502 },
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await siteverifyResponse.json();
  } catch {
    return Response.json(
      { error: "Phản hồi từ dịch vụ captcha không hợp lệ." },
      { status: 502 },
    );
  }

  if (!isTurnstileResponse(responseBody)) {
    return Response.json(
      { error: "Phản hồi từ dịch vụ captcha không hợp lệ." },
      { status: 502 },
    );
  }

  const result = responseBody;
  if (!result.success || result.action !== "task_claim") {
    return Response.json(
      { error: "Captcha không hợp lệ hoặc đã hết hạn. Vui lòng xác minh lại." },
      { status: 400 },
    );
  }

  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedHostnames.length > 0 &&
    (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
  ) {
    return Response.json({ error: "Captcha không hợp lệ cho tên miền này." }, { status: 400 });
  }

  return Response.json({ verified: true });
}
