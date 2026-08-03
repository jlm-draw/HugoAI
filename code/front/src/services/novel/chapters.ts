import { prisma } from "@/lib/db";

/** 字数统计：去除所有空白字符后的字符数（中文按字符计） */
export function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** 汇总小说总字数（所有章节 wordCount 之和） */
export async function syncNovelWordCount(novelId: string): Promise<void> {
  const agg = await prisma.chapter.aggregate({
    where: { novelId },
    _sum: { wordCount: true },
  });
  await prisma.novel.update({
    where: { id: novelId },
    data: { wordCount: agg._sum.wordCount ?? 0 },
  });
}

/** 校验是否为合法的 Tiptap 文档 JSON（空文档可能不带 content 数组，放宽判断） */
export function isTiptapDoc(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc";
}
