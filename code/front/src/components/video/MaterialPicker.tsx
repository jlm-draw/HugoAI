"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface MaterialVideo {
  id: string;
  thumb: string;
  duration: number;
  files: Array<{ quality: string; width: number; height: number; link: string }>;
}

const ORIENTATIONS = [
  { code: "portrait", name: "竖屏" },
  { code: "landscape", name: "横屏" },
  { code: "all", name: "全部" },
] as const;

interface Props {
  projectId: string;
  scriptId: string;
  shot: { id: string; sort: number; visual: string; materialQuery: string | null };
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function MaterialPicker({ projectId, scriptId, shot, open, onClose, onSaved }: Props) {
  // 组件每次打开都是全新挂载（ScriptDetail 以 pickerShot 条件渲染），初始值直接取自 shot
  const [query, setQuery] = useState(() => shot.materialQuery ?? "");
  const [orientation, setOrientation] = useState<string>("portrait");
  const [videos, setVideos] = useState<MaterialVideo[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(() => Boolean(shot.materialQuery?.trim()));
  const [loadingMore, setLoadingMore] = useState(false);
  const [preview, setPreview] = useState<MaterialVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (page: number, append: boolean, q: string, ori: string) => {
    if (!q.trim()) {
      toast.add({ type: "error", title: "请输入搜索关键词" });
      return;
    }
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(
        `/api/video/materials/search?query=${encodeURIComponent(q.trim())}&orientation=${ori}&page=${page}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "搜索失败");
      setVideos((prev) => (append ? [...prev, ...(json.videos ?? [])] : json.videos ?? []));
      setNextPage(json.nextPage ?? null);
      setPreview(null);
      setSearched(true);
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "搜索失败" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 挂载时有 AI 预生成关键词则自动搜一次
  useEffect(() => {
    const q = shot.materialQuery?.trim();
    if (!q) return;
    let ignore = false;
    async function autoSearch(kw: string) {
      try {
        const res = await fetch(
          `/api/video/materials/search?query=${encodeURIComponent(kw)}&orientation=portrait&page=1`
        );
        const json = await res.json();
        if (ignore) return;
        if (!res.ok) throw new Error(json.error ?? "搜索失败");
        setVideos(json.videos ?? []);
        setNextPage(json.nextPage ?? null);
        setSearched(true);
      } catch (err) {
        if (!ignore) {
          toast.add({ type: "error", title: err instanceof Error ? err.message : "搜索失败" });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    autoSearch(q);
    return () => {
      ignore = true;
    };
    // 仅挂载时执行一次（组件每次打开都重新挂载）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmPick(video: MaterialVideo) {
    const file = video.files[0];
    if (!file) {
      toast.add({ type: "error", title: "该素材没有可用的视频文件" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${scriptId}/shots/${shot.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialUrl: file.link,
            materialThumb: video.thumb,
            materialQuery: query.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      await onSaved();
      toast.add({ type: "success", title: "素材已选择" });
      onClose();
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择素材 — 镜头 #{shot.sort}</DialogTitle>
          <p className="line-clamp-1 text-xs text-gray-400">画面：{shot.visual}</p>
        </DialogHeader>

        <div className="space-y-3">
          {/* 搜索栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void doSearch(1, false, query, orientation);
              }}
              placeholder="英文关键词，如 city night timelapse"
              maxLength={80}
              className="min-w-40 flex-1"
            />
            <div className="flex gap-1">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.code}
                  onClick={() => setOrientation(o.code)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    orientation === o.code
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {o.name}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="gap-1"
              disabled={loading}
              onClick={() => void doSearch(1, false, query, orientation)}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              搜索
            </Button>
          </div>

          {/* 预览区 */}
          {preview && (
            <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
              <video
                src={preview.files[0]?.link}
                controls
                autoPlay
                muted
                loop
                className="max-h-56 w-full rounded bg-black object-contain"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {preview.duration} 秒 · {(preview.files[0]?.quality ?? "").toUpperCase()}
                </p>
                <Button size="sm" disabled={saving} onClick={() => confirmPick(preview)}>
                  {saving ? "保存中…" : "使用此素材"}
                </Button>
              </div>
            </div>
          )}

          {/* 结果区 */}
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : videos.length === 0 && searched ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clapperboard size={28} className="mb-2 text-gray-300" />
              <p className="text-xs text-gray-400">没搜到素材，换个关键词试试</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-xs text-gray-400">
              输入关键词点「搜索」（推荐用 AI 预生成的英文关键词）
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPreview(v)}
                    className={cn(
                      "relative overflow-hidden rounded-md border",
                      preview?.id === v.id
                        ? "border-blue-400 ring-1 ring-blue-200"
                        : "hover:border-gray-300"
                    )}
                  >
                    <img src={v.thumb} alt="" loading="lazy" className="h-28 w-full object-cover" />
                    <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {v.duration}s
                    </span>
                  </button>
                ))}
              </div>
              {nextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={loadingMore}
                  onClick={() => void doSearch(nextPage, true, query, orientation)}
                >
                  {loadingMore ? "加载中…" : "加载更多"}
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-right text-[10px] text-gray-400">
          素材来自{" "}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Pexels ↗
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
