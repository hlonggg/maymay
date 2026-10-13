export function hasSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }

  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") {
    return false;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return false;

  return origin.host.toLowerCase() === host.toLowerCase();
}
