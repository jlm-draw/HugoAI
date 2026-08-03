/**
 * 小说写作模块共享类型与常量（前后端通用，勿引入服务端依赖）。
 */

/** 小说类型 */
export const GENRES = [
  "玄幻",
  "仙侠",
  "都市",
  "科幻",
  "悬疑",
  "历史",
  "言情",
  "游戏",
] as const;

export type Genre = (typeof GENRES)[number];

/** 类型对应的 emoji（无封面时占位展示） */
export const GENRE_EMOJI: Record<string, string> = {
  玄幻: "⚔️",
  仙侠: "🌄",
  都市: "🏙️",
  科幻: "🚀",
  悬疑: "🔍",
  历史: "📜",
  言情: "💌",
  游戏: "🎮",
};

export const DEFAULT_GENRE_EMOJI = "📖";

/** 小说列表卡片 / 工作台头部用的摘要信息 */
export interface NovelSummary {
  id: string;
  name: string;
  description: string | null;
  genre: string;
  cover: string | null;
  wordCount: number;
  chapterCount: number;
  updatedAt: string;
}

/** 世界观设定（背景 / 时间线 / 地理） */
export interface WorldSettingData {
  background: string;
  timeline: string;
  geography: string;
}

export interface CharacterItem {
  id: string;
  name: string;
  avatar: string | null;
  personality: string | null;
  background: string | null;
}

export interface RelationItem {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  label: string;
}

/** 章节（content 为 Tiptap JSON 文档，仅工作台接口返回） */
export interface ChapterItem {
  id: string;
  title: string;
  summary: string | null;
  wordCount: number;
  sort: number;
  content?: unknown;
}

/** GET /api/novel/[id] 返回的工作台全量数据 */
export interface WorkspaceData {
  novel: NovelSummary;
  worldSetting: WorldSettingData;
  characters: CharacterItem[];
  relations: RelationItem[];
  chapters: ChapterItem[];
}

/** 新建小说时的 AI 建议 */
export interface SuggestedCharacter {
  name: string;
  personality: string;
  background: string;
}

export interface NovelSuggestion {
  world: WorldSettingData;
  characters: SuggestedCharacter[];
}

/** AI 生成的章节大纲条目（标题 + 大概内容） */
export interface ChapterOutlineItem {
  title: string;
  summary: string;
}

/** 润色模式 */
export type PolishMode = "style" | "condense" | "expand";

export const POLISH_LABELS: Record<PolishMode, string> = {
  style: "调整风格",
  condense: "精简",
  expand: "扩写",
};

/** 一致性检查发现的矛盾 */
export interface ConsistencyIssue {
  /** 与设定矛盾的原文片段 */
  quote: string;
  /** 问题说明 */
  problem: string;
  /** 修改建议 */
  suggestion: string;
}
