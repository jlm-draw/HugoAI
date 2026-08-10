"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, Search, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type GenStatus = "idle" | "submitting" | "running" | "done" | "error";

interface Props {
  projectId: string;
  scriptId: string;
  shot: { id: string; sort: number; visual: string; materialQuery: string | null };
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function MaterialPicker({ projectId, scriptId, shot, open, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"search" | "generate">("search");

  // ============ 搜索素材（Pexels） ============
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

  // ============ AI 生成素材（通义万相） ============
  const [genPrompt, setGenPrompt] = useState(() => shot.visual);
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [genFileUrl, setGenFileUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const genVideoRef = useRef<HTMLVideoElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

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

  /** 轮询生成任务，最长 6 分钟 */
  async function pollTask(taskId: string) {
    for (let i = 0; i < 72; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      if (cancelledRef.current) return;
      try {
        const res = await fetch(`/api/video/materials/generate/${taskId}`);
        const json = await res.json();
        if (!res.ok) {
          setGenStatus("error");
          setGenError(json.error ?? "生成失败，请重试");
          return;
        }
        if (json.status === "SUCCEEDED") {
          setGenFileUrl(json.fileUrl);
          setGenStatus("done");
          return;
        }
      } catch {
        // 网络抖动：继续轮询
      }
    }
    setGenStatus("error");
    setGenError("生成超时，请重试");
  }

  async function startGenerate() {
    const prompt = genPrompt.trim();
    if (!prompt) {
      toast.add({ type: "error", title: "请输入画面描述" });
      return;
    }
    setGenStatus("submitting");
    setGenError(null);
    setGenFileUrl(null);
    try {
      const res = await fetch("/api/video/materials/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "提交失败");
      setGenStatus("running");
      void pollTask(json.taskId);
    } catch (err) {
      setGenStatus("error");
      setGenError(err instanceof Error ? err.message : "提交失败");
    }
  }

  /** 从视频当前帧截取封面（失败返回 null，不阻塞保存） */
  function captureThumb(): Promise<Blob | null> {
    const video = genVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7));
  }

  async function confirmGenerate() {
    if (!genFileUrl) return;
    setSaving(true);
    try {
      let materialThumb: string | null = null;
      try {
        const blob = await captureThumb();
        if (blob) {
          const res = await fetch("/api/video/materials/thumbnail", {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });
          const json = await res.json();
          if (res.ok) materialThumb = json.fileUrl;
        }
      } catch {
        // 封面截取失败不影响素材本身
      }
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${scriptId}/shots/${shot.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialUrl: genFileUrl,
            materialThumb,
            materialQuery: query.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      await onSaved();
      toast.add({ type: "success", title: "AI 素材已保存" });
      onClose();
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

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
          <DialogTitle>素材 — 镜头 #{shot.sort}</DialogTitle>
          <p className="line-clamp-1 text-xs text-gray-400">画面：{shot.visual}</p>
        </DialogHeader>

        {/* 模式切换 */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setMode("search")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              mode === "search" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Search size={13} /> 搜索素材（Pexels）
          </button>
          <button
            onClick={() => setMode("generate")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              mode === "generate" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Wand2 size={13} /> AI 生成素材
          </button>
        </div>

        {mode === "search" ? (
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
                <p className="text-xs text-gray-400">
                  没搜到素材，换个关键词试试，或切换到「AI 生成素材」
                </p>
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
          </div>
        ) : (
          <div className="space-y-3">
            {/* 画面描述 */}
            <div className="space-y-1.5">
              <Textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="描述这个镜头的画面，如：夜晚的城市街头，霓虹灯闪烁，行人匆匆走过，镜头缓慢推进"
                disabled={genStatus === "running" || genStatus === "submitting"}
              />
              <p className="text-[11px] text-gray-400">
                通义万相文生视频 · 竖屏 9:16 · 5 秒 720P · 生成约需 1-3 分钟（有 API 费用）
              </p>
            </div>

            {/* 状态区 */}
            {genStatus === "idle" || genStatus === "error" ? (
              <div className="space-y-2">
                <Button className="gap-1.5" onClick={() => void startGenerate()}>
                  <Sparkles size={14} /> 开始生成
                </Button>
                {genError && <p className="text-xs text-red-500">{genError}</p>}
              </div>
            ) : genStatus === "submitting" || genStatus === "running" ? (
              <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <Loader2 size={15} className="animate-spin text-blue-500" />
                <p className="text-xs text-blue-600">
                  正在生成视频，约需 1-3 分钟，可先处理其他镜头，请勿关闭弹框…
                </p>
              </div>
            ) : (
              genFileUrl && (
                <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
                  <video
                    ref={genVideoRef}
                    src={genFileUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    className="max-h-56 w-full rounded bg-black object-contain"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">5 秒 · 720P · AI 生成</p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => void startGenerate()}>
                        重新生成
                      </Button>
                      <Button size="sm" disabled={saving} onClick={() => void confirmGenerate()}>
                        {saving ? "保存中…" : "使用此素材"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
