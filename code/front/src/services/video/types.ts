/**
 * 短视频模块共享类型与常量（前后端通用，勿引入服务端依赖）。
 */

/** 短视频赛道（内容方向） */
export const TRACKS = [
  { code: "ai-news", name: "AI/科技资讯解读", emoji: "🤖" },
  { code: "novel-promo", name: "小说推文", emoji: "📚" },
  { code: "emotion", name: "情感/知识口播", emoji: "💡" },
  { code: "general", name: "通用", emoji: "🎬" },
] as const;

export type TrackCode = (typeof TRACKS)[number]["code"];

export function trackName(code: string): string {
  return TRACKS.find((t) => t.code === code)?.name ?? code;
}

export function trackEmoji(code: string): string {
  return TRACKS.find((t) => t.code === code)?.emoji ?? "🎬";
}

/** 单个分镜 */
export interface VideoShotItem {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
}

/** 脚本（含分镜；列表与详情共用） */
export interface VideoScriptItem {
  id: string;
  track: string;
  topic: string;
  /** 采用的主标题（默认是 titles[0]） */
  title: string;
  /** AI 生成的候选标题（5 个） */
  titles: string[];
  /** 完整口播稿 */
  narration: string;
  createdAt: string;
  shots: VideoShotItem[];
  /** 来源新闻（无则为 null） */
  news: { title: string; url: string; source: string } | null;
}

/** 项目卡片摘要 */
export interface VideoProjectSummary {
  id: string;
  name: string;
  positioning: string | null;
  scriptCount: number;
  updatedAt: string;
}

/** GET /api/video/projects/[id] 返回的工作台全量数据 */
export interface VideoWorkspaceData {
  project: VideoProjectSummary;
  scripts: VideoScriptItem[];
}
