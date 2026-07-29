import { NextResponse } from "next/server";
import { runCrawlers } from "@/services/news/crawler";
import { allCrawlers } from "@/services/news/crawlers";

export async function POST() {
  try {
    const result = await runCrawlers(allCrawlers);
    return NextResponse.json({
      success: true,
      newArticles: result.totalNew,
      totalFetched: result.totalFetched,
      sources: result.results.map((r) => ({
        source: r.source,
        count: r.items.length,
        error: r.error,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
