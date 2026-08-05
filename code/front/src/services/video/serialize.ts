import type { Prisma } from "@prisma/client";
import type { VideoScriptItem, VideoShotItem } from "./types";

type ScriptWithShots = Prisma.VideoScriptGetPayload<{
  include: { shots: true; news: true };
}>;

export function serializeShot(shot: {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
  materialQuery: string | null;
  materialUrl: string | null;
  materialThumb: string | null;
}): VideoShotItem {
  return {
    id: shot.id,
    sort: shot.sort,
    visual: shot.visual,
    line: shot.line,
    duration: shot.duration,
    materialQuery: shot.materialQuery,
    materialUrl: shot.materialUrl,
    materialThumb: shot.materialThumb,
  };
}

export function serializeScript(script: ScriptWithShots): VideoScriptItem {
  return {
    id: script.id,
    track: script.track,
    topic: script.topic,
    title: script.title,
    titles: Array.isArray(script.titles) ? (script.titles as unknown as string[]) : [],
    narration: script.narration,
    createdAt: script.createdAt.toISOString(),
    shots: [...script.shots].sort((a, b) => a.sort - b.sort).map(serializeShot),
    news: script.news
      ? { title: script.news.title, url: script.news.url, source: script.news.source }
      : null,
    voice: script.voice,
    audioUrl: script.audioUrl,
    srt: script.srt,
  };
}
