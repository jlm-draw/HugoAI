"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  DEFAULT_GENRE_EMOJI,
  GENRES,
  GENRE_EMOJI,
  type NovelSummary,
} from "@/services/novel/types";
import { NovelCreateDialog } from "./NovelCreateDialog";

function formatCount(n: number): string {
  return n.toLocaleString("zh-CN");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const COVER_GRADIENTS = [
  "from-blue-100 to-indigo-200",
  "from-amber-100 to-orange-200",
  "from-emerald-100 to-teal-200",
  "from-rose-100 to-pink-200",
  "from-violet-100 to-purple-200",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

export function NovelList() {
  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // 编辑对话框
  const [editing, setEditing] = useState<NovelSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCover, setEditCover] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleting, setDeleting] = useState<NovelSummary | null>(null);

  // 事件回调（增删改后）使用的刷新
  const fetchNovels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/novel");
      const json = await res.json();
      if (res.ok) setNovels(json.novels ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次挂载加载：effect 内不做同步 setState（loading 初值即 true）
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/novel");
        const json = await res.json();
        if (!ignore && res.ok) setNovels(json.novels ?? []);
      } catch {
        // 网络异常时保持空列表
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  function openEdit(novel: NovelSummary) {
    setEditing(novel);
    setEditName(novel.name);
    setEditGenre(novel.genre);
    setEditDesc(novel.description ?? "");
    setEditCover(novel.cover ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/novel/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          genre: editGenre,
          description: editDesc.trim(),
          cover: editCover.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      setEditing(null);
      await fetchNovels();
      toast.add({ type: "success", title: "小说信息已保存" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/novel/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      setDeleting(null);
      await fetchNovels();
      toast.add({ type: "success", title: "小说已删除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">小说写作</h1>
          <p className="text-xs text-gray-400">结构化设定 + AI 辅助，写你的故事</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} /> 新建小说
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-white" />
          ))}
        </div>
      ) : novels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <BookOpen size={32} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">还没有小说</p>
          <p className="mb-4 text-xs text-gray-400">点击「新建小说」开始你的创作</p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} /> 新建第一部小说
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {novels.map((novel) => (
            <div
              key={novel.id}
              className="group relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
            >
              <Link href={`/novel/${novel.id}`} className="block">
                {novel.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={novel.cover}
                    alt={novel.name}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-24 w-full items-center justify-center bg-gradient-to-br ${gradientFor(
                      novel.id
                    )}`}
                  >
                    <span className="text-3xl">
                      {GENRE_EMOJI[novel.genre] ?? DEFAULT_GENRE_EMOJI}
                    </span>
                  </div>
                )}
                <div className="space-y-1.5 p-3.5">
                  <div className="flex items-center gap-2">
                    <h2 className="flex-1 truncate text-sm font-semibold text-gray-800">
                      {novel.name}
                    </h2>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {novel.genre}
                    </Badge>
                  </div>
                  {novel.description && (
                    <p className="line-clamp-2 text-xs text-gray-400">{novel.description}</p>
                  )}
                  <p className="pt-1 text-[11px] text-gray-400">
                    {novel.chapterCount} 章 · {formatCount(novel.wordCount)} 字 · 更新于{" "}
                    {formatDate(novel.updatedAt)}
                  </p>
                </div>
              </Link>
              <div className="absolute top-1.5 right-1.5 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => openEdit(novel)}
                  className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-blue-600"
                  title="编辑信息"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeleting(novel)}
                  className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-red-500"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <NovelCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* 编辑小说信息 */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑小说信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={editGenre} onValueChange={(v: string | null) => setEditGenre(v ?? "")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>简介</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label>封面图片 URL（可选）</Label>
              <Input
                value={editCover}
                onChange={(e) => setEditCover(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除小说</DialogTitle>
            <DialogDescription>
              确定删除《{deleting?.name}》吗？所有章节、人物与设定将一并删除，无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
