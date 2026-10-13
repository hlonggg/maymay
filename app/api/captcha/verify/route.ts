import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const result = await verifyTurnstile(body.token, "task_claim");
  if (!result.verified) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ verified: true });
}
