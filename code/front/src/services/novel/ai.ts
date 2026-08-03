import { chat, chatStream } from "@/lib/ai";
import {
  SYSTEM_CONSISTENCY,
  SYSTEM_CONTINUE,
  SYSTEM_DIALOGUE,
  SYSTEM_POLISH,
  SYSTEM_SCENE,
  SYSTEM_SUGGEST,
} from "./prompts";
import type {
  ConsistencyIssue,
  NovelSuggestion,
  PolishMode,
  SuggestedCharacter,
  WorldSettingData,
} from "./types";

/** AI 能力共用的故事背景上下文 */
export interface StoryContext {
  genre: string;
  world: WorldSettingData | null;
  characters: Array<{ name: string; personality: string | null; background: string | null }>;
}

/** 从数据库实体构建故事上下文（novel 为 getOwnedNovel 的返回值） */
export function buildStoryContext(novel: {
  genre: string;
  worldSetting: { background: string; timeline: string; geography: string } | null;
  characters: Array<{ name: string; personality: string | null; background: string | null }>;
}): StoryContext {
  return {
    genre: novel.genre,
    world: novel.worldSetting
      ? {
          background: novel.worldSetting.background,
          timeline: novel.worldSetting.timeline,
          geography: novel.worldSetting.geography,
        }
      : null,
    characters: novel.characters.map((c) => ({
      name: c.name,
      personality: c.personality,
      background: c.background,
    })),
  };
}

/** 送入模型的正文尾部长度（控制 token） */
const TAIL_CHARS = 2000;
/** 送入模型的上一章尾部长度 */
const PREV_TAIL_CHARS = 600;
/** 一致性检查送入模型的最大正文长度 */
const CONSISTENCY_MAX_CHARS = 6000;

function tail(text: string, n: number): string {
  return text.length > n ? "……" + text.slice(-n) : text;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 组装「设定块」：类型 + 世界观 + 人物小传 */
function buildSettingBlock(ctx: StoryContext): string {
  const lines: string[] = [`类型：${ctx.genre}`];
  if (ctx.world) {
    if (ctx.world.background.trim()) lines.push(`【背景设定】${ctx.world.background}`);
    if (ctx.world.timeline.trim()) lines.push(`【时间线】${ctx.world.timeline}`);
    if (ctx.world.geography.trim()) lines.push(`【地理设定】${ctx.world.geography}`);
  }
  if (ctx.characters.length > 0) {
    lines.push("【主要人物】");
    for (const c of ctx.characters) {
      const parts = [c.name];
      if (c.personality) parts.push(`性格：${c.personality}`);
      if (c.background) parts.push(`背景：${c.background}`);
      lines.push(parts.join(" | "));
    }
  }
  return lines.join("\n");
}

/** 从模型输出中提取 JSON（兼容 markdown 代码块与前后多余文字） */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```/g, "");
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("AI 输出格式异常，请重试");
  const start = Math.min(...starts);
  const end = cleaned[start] === "{" ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
  if (end <= start) throw new Error("AI 输出格式异常，请重试");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** 新建小说：根据类型/主题生成世界观与人物建议 */
export async function suggestNovel(genre: string, theme: string): Promise<NovelSuggestion> {
  const result = await chat(
    [
      {
        role: "user",
        content: `小说类型：${genre}\n主题或创意：${theme}\n请设计世界观与主要人物。`,
      },
    ],
    { systemPrompt: SYSTEM_SUGGEST, temperature: 0.8, maxTokens: 2000 }
  );

  const parsed = extractJson(result) as {
    world?: { background?: unknown; timeline?: unknown; geography?: unknown };
    characters?: Array<{ name?: unknown; personality?: unknown; background?: unknown }>;
  };

  const characters: SuggestedCharacter[] = Array.isArray(parsed?.characters)
    ? parsed.characters.slice(0, 6).map((c) => ({
        name: str(c?.name) || "未命名",
        personality: str(c?.personality),
        background: str(c?.background),
      }))
    : [];

  return {
    world: {
      background: str(parsed?.world?.background),
      timeline: str(parsed?.world?.timeline),
      geography: str(parsed?.world?.geography),
    },
    characters,
  };
}

/** 续写：从选中段落之后（或章节末尾）继续写 */
export async function* streamContinue(
  ctx: StoryContext,
  opts: {
    chapterTitle: string;
    chapterText: string;
    prevChapterText?: string | null;
    selection?: string | null;
  }
): AsyncGenerator<string> {
  const anchor = opts.selection?.trim() ? opts.selection.trim() : opts.chapterText;
  if (!anchor.trim()) {
    throw new Error("本章还没有内容，请先写一些正文或使用「场景写作」");
  }

  const parts = [buildSettingBlock(ctx), `\n【当前章节】${opts.chapterTitle}`];
  if (opts.prevChapterText?.trim()) {
    parts.push(`【上一章结尾】\n${tail(opts.prevChapterText, PREV_TAIL_CHARS)}`);
  }
  parts.push(`【待续写正文】\n${tail(anchor, TAIL_CHARS)}`);
  parts.push(
    opts.selection?.trim()
      ? "\n请紧接【待续写正文】这段文字之后往下续写。"
      : "\n请从【待续写正文】的结尾处往下续写。"
  );

  yield* chatStream([{ role: "user", content: parts.join("\n") }], {
    systemPrompt: SYSTEM_CONTINUE,
    temperature: 0.9,
    maxTokens: 2000,
  });
}

/** 指定章节写特定场景 */
export async function* streamScene(
  ctx: StoryContext,
  opts: { chapterTitle: string; chapterText: string; scene: string }
): AsyncGenerator<string> {
  const parts = [buildSettingBlock(ctx), `\n【当前章节】${opts.chapterTitle}`];
  if (opts.chapterText.trim()) {
    parts.push(`【本章已有正文（结尾部分）】\n${tail(opts.chapterText, TAIL_CHARS)}`);
  }
  parts.push(`【要写的场景】\n${opts.scene}`);
  parts.push("\n请写出这个场景，与已有正文自然衔接。");

  yield* chatStream([{ role: "user", content: parts.join("\n") }], {
    systemPrompt: SYSTEM_SCENE,
    temperature: 0.9,
    maxTokens: 2500,
  });
}

const POLISH_INSTRUCTIONS: Record<PolishMode, string> = {
  style: "请润色下面的文字，调整语言风格使其更有文采、更流畅，保持原意不变。",
  condense: "请精简下面的文字，删除冗余表达，保留核心信息与情节。",
  expand:
    "请扩写下面的文字，补充细节、感官描写与氛围渲染，不要引入新的剧情转折。",
};

/** 润色：改写选中文字（调整风格 / 精简 / 扩写） */
export async function* streamPolish(
  text: string,
  mode: PolishMode,
  note?: string
): AsyncGenerator<string> {
  const content = `${POLISH_INSTRUCTIONS[mode]}${note?.trim() ? `\n附加要求：${note.trim()}` : ""}\n\n【待润色文字】\n${text}`;
  yield* chatStream([{ role: "user", content }], {
    systemPrompt: SYSTEM_POLISH,
    temperature: 0.7,
    maxTokens: 3000,
  });
}

/** 对话生成：根据人物性格与情境写对话 */
export async function* streamDialogue(
  ctx: StoryContext,
  involved: StoryContext["characters"],
  scenario: string
): AsyncGenerator<string> {
  const parts = [buildSettingBlock(ctx)];
  parts.push("\n【参与对话的人物】");
  for (const c of involved) {
    const desc = [c.name];
    if (c.personality) desc.push(`性格：${c.personality}`);
    if (c.background) desc.push(`背景：${c.background}`);
    parts.push(desc.join(" | "));
  }
  parts.push(`【情境设定】\n${scenario}`);
  parts.push("\n请写出以上人物之间的对话。");

  yield* chatStream([{ role: "user", content: parts.join("\n") }], {
    systemPrompt: SYSTEM_DIALOGUE,
    temperature: 0.9,
    maxTokens: 2000,
  });
}

/** 一致性检查：找出正文与设定矛盾之处 */
export async function checkConsistency(
  ctx: StoryContext,
  chapterText: string
): Promise<ConsistencyIssue[]> {
  if (!chapterText.trim()) return [];

  const content = `【小说设定】\n${buildSettingBlock(ctx)}\n\n【本章正文】\n${tail(
    chapterText,
    CONSISTENCY_MAX_CHARS
  )}`;
  const result = await chat([{ role: "user", content }], {
    systemPrompt: SYSTEM_CONSISTENCY,
    temperature: 0.2,
    maxTokens: 2000,
  });

  const parsed = extractJson(result);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, 5)
    .map((item: { quote?: unknown; problem?: unknown; suggestion?: unknown }) => ({
      quote: str(item?.quote),
      problem: str(item?.problem),
      suggestion: str(item?.suggestion),
    }))
    .filter((issue) => issue.quote || issue.problem);
}
