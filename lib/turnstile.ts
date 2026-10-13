type TurnstileSiteverifyResponse = {
  success: boolean;
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

export async function verifyTurnstile(
  token: string,
  expectedAction: string,
  remoteIp?: string,
): Promise<{ verified: true } | { verified: false; status: number; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { verified: false, status: 503, error: "Captcha chưa được cấu hình trên máy chủ." };
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    return { verified: false, status: 502, error: "Không thể kết nối dịch vụ captcha. Vui lòng thử lại." };
  }

  if (!response.ok) {
    return { verified: false, status: 502, error: "Dịch vụ captcha tạm thời không khả dụng." };
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    return { verified: false, status: 502, error: "Phản hồi từ dịch vụ captcha không hợp lệ." };
  }

  if (!isTurnstileResponse(result)) {
    return { verified: false, status: 502, error: "Phản hồi từ dịch vụ captcha không hợp lệ." };
  }

  if (!result.success || result.action !== expectedAction) {
    return { verified: false, status: 400, error: "Captcha không hợp lệ hoặc đã hết hạn. Vui lòng xác minh lại." };
  }

  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (
    allowedHostnames.length > 0 &&
    (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
  ) {
    return { verified: false, status: 400, error: "Captcha không hợp lệ cho tên miền này." };
  }

  return { verified: true };
}
