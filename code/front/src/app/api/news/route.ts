import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const source = searchParams.get("source");
  const category = searchParams.get("category");
  const skip = (page - 1) * pageSize;

  const where = {
    ...(source ? { source } : {}),
    ...(category ? { category } : {}),
  };
  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, pageSize });
}
