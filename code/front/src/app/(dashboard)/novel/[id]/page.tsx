import { NovelWorkspace } from "@/components/novel/NovelWorkspace";

export default async function NovelWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NovelWorkspace novelId={id} />;
}
