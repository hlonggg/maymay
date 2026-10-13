import { isIP } from "node:net";

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const candidate = (forwardedFor?.split(",")[0] ?? request.headers.get("x-real-ip"))
    ?.trim()
    .replace(/^"(.*)"$/, "$1");

  return candidate && isIP(candidate) ? candidate : null;
}
