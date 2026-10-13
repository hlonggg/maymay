import { isAdminTelegramId, readSessionTelegramId } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";

export async function getAdminTelegramId(request: Request): Promise<string | null> {
  const telegramId = readSessionTelegramId(request);
  if (!telegramId || !isAdminTelegramId(telegramId)) return null;

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { blockedAt: true },
  });
  return user && !user.blockedAt ? telegramId : null;
}
