import type { Prisma } from "@prisma/client";
import type { VideoScriptItem, VideoShotItem } from "./types";

type ScriptWithShots = Prisma.VideoScriptGetPayload<{ include: { shots: true } }>;

export function serializeShot(shot: {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
}): VideoShotItem {
  return {
    id: shot.id,
    sort: shot.sort,
    visual: shot.visual,
    line: shot.line,
    duration: shot.duration,
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
  };
}
