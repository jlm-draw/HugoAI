"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  TRACKS,
  trackEmoji,
  trackName,
  type VideoWorkspaceData,
} from "@/services/video/types";
import { ScriptDetail } from "./ScriptDetail";

interface Props {
  projectId: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function VideoWorkspace({ projectId }: Props) {
  const [data, setData] = useState<VideoWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [track, setTrack] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; topic: string } | null>(null);
  const [newsList, setNewsList] = useState<
    Array<{ id: string; title: string; source: string; createdAt: string }>
  >([]);
  const [newsId, setNewsId] = useState<string | null>(null);

  /** 静默刷新（不动 loading，避免生成后整页闪骨架屏） */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/projects/${projectId}`);
      const json = await res.json();
      if (res.ok) setData(json as VideoWorkspaceData);
    } catch {
      // 刷新失败保持当前数据
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/video/projects/${projectId}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setData(json as VideoWorkspaceData);
          setSelectedId(json.scripts?.[0]?.id ?? null);
        }
      } catch {
        // 网络异常时保持空状态
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  // 赛道为 AI 资讯解读时，拉取最近资讯供选择（只拉一次）
  useEffect(() => {
    if (track !== "ai-news" || newsList.length > 0) return;
    let ignore = false;
    async function loadNews() {
      try {
        const res = await fetch("/api/news?page=1&pageSize=50");
        const json = await res.json();
        if (!ignore && res.ok) setNewsList(json.articles ?? []);
      } catch {
        // 加载失败保持空列表
      }
    }
    loadNews();
    return () => {
      ignore = true;
    };
  }, [track, newsList.length]);

  function handleSelectNews(id: string | null) {
    setNewsId(id ?? null);
    const article = newsList.find((n) => n.id === id);
    if (article) setTopic(article.title);
  }

  async function handleGenerate() {
    if (!track) {
      toast.add({ type: "error", title: "请先选择内容赛道" });
      return;
    }
    if (!topic.trim()) {
      toast.add({ type: "error", title: "请填写视频选题" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/video/projects/${projectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, topic: topic.trim(), newsId: newsId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成失败");
      await refresh();
      setSelectedId(json.script?.id ?? null);
      setTopic("");
      setNewsId(null);
      toast.add({ type: "success", title: "脚本已生成" });
    } catch (err) {
      toast.add({
        type: "error",
        title: err instanceof Error ? err.message : "生成失败",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDeleteScript() {
    if (!deleting) return;
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${deleting.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      const removedId = deleting.id;
      setDeleting(null);
      await refresh();
      setSelectedId((cur) => (cur === removedId ? null : cur));
      toast.add({ type: "success", title: "脚本已删除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  const selected = data?.scripts.find((s) => s.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg border bg-white" />
        <div className="h-32 animate-pulse rounded-xl border bg-white" />
        <div className="h-96 animate-pulse rounded-xl border bg-white" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Clapperboard size={32} className="mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">项目不存在或加载失败</p>
        <Link href="/video" className="mt-3 text-xs text-blue-600 hover:underline">
          返回项目列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <Link
          href="/video"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft size={13} /> 返回
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-800">{data.project.name}</h1>
          {data.project.positioning && (
            <p className="truncate text-xs text-gray-400">{data.project.positioning}</p>
          )}
        </div>
      </div>

      {/* 生成新脚本 */}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Sparkles size={14} className="text-blue-500" /> 生成新脚本
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-1.5 sm:w-44">
            <Label>内容赛道</Label>
            <Select
              value={track}
              onValueChange={(v: string | null) => {
                setTrack(v ?? "");
                setNewsId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择赛道" />
              </SelectTrigger>
              <SelectContent>
                {TRACKS.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.emoji} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {track === "ai-news" && (
            <div className="w-full space-y-1.5 sm:w-72">
              <Label>选择新闻（自动带标题和原文素材）</Label>
              {newsList.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-gray-400">
                  暂无资讯，请先去{" "}
                  <Link href="/news" className="text-blue-600 hover:underline">
                    AI 资讯
                  </Link>{" "}
                  页抓取
                </p>
              ) : (
                <Select value={newsId ?? ""} onValueChange={handleSelectNews}>
                  <SelectTrigger>
                    <SelectValue placeholder="从最近资讯中选择一条" />
                  </SelectTrigger>
                  <SelectContent>
                    {newsList.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}（{n.source} · {formatDate(n.createdAt)}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <Label>视频选题</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="这条视频想讲什么？如：GPT-5 发布了，普通人怎么用它提升效率"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5 sm:w-32">
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {generating ? "AI 写作中…" : "生成脚本"}
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          生成约需 10-30 秒，产出 5 个爆款标题 + 60 秒口播稿 + 分镜表
        </p>
      </div>

      {/* 脚本列表 + 详情 */}
      {data.scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Clapperboard size={32} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">还没有脚本</p>
          <p className="text-xs text-gray-400">在上方输入选题，点「生成脚本」产出第一条</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {data.scripts.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "group cursor-pointer rounded-lg border bg-white p-3 transition-colors",
                  selectedId === s.id
                    ? "border-blue-400 ring-1 ring-blue-200"
                    : "hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 flex-1 text-sm font-medium text-gray-700">
                    {s.topic}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting({ id: s.id, topic: s.topic });
                    }}
                    className="hidden shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:block"
                    title="删除脚本"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  {trackEmoji(s.track)} {trackName(s.track)} · {formatDate(s.createdAt)}
                </p>
              </div>
            ))}
          </div>
          <div>
            {selected ? (
              <ScriptDetail script={selected} />
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed py-16 text-sm text-gray-400">
                在左侧选择一个脚本查看详情
              </div>
            )}
          </div>
        </div>
      )}

      {/* 删除脚本确认 */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除脚本</DialogTitle>
            <DialogDescription>
              确定删除选题「{deleting?.topic}」的脚本吗？删除后无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteScript}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
