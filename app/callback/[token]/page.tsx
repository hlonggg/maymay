import TaskCallback from "@/app/components/TaskCallback";

export const metadata = {
  title: "Xác nhận nhiệm vụ · Maymay",
  referrer: "no-referrer" as const,
};

export default async function CallbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TaskCallback token={token} />;
}
