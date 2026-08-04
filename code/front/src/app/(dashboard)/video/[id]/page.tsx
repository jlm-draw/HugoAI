import { VideoWorkspace } from "@/components/video/VideoWorkspace";

export default async function VideoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideoWorkspace projectId={id} />;
}
