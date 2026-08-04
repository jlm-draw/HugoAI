"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { VideoProjectSummary } from "@/services/video/types";
import { VideoCreateDialog } from "./VideoCreateDialog";

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

export function VideoProjectList() {
  const [projects, setProjects] = useState<VideoProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // 编辑对话框
  const [editing, setEditing] = useState<VideoProjectSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editPositioning, setEditPositioning] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleting, setDeleting] = useState<VideoProjectSummary | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/video/projects");
      const json = await res.json();
      if (res.ok) setProjects(json.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/video/projects");
        const json = await res.json();
        if (!ignore && res.ok) setProjects(json.projects ?? []);
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

  function openEdit(project: VideoProjectSummary) {
    setEditing(project);
    setEditName(project.name);
    setEditPositioning(project.positioning ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/video/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          positioning: editPositioning.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      setEditing(null);
      await fetchProjects();
      toast.add({ type: "success", title: "项目信息已保存" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/video/projects/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      setDeleting(null);
      await fetchProjects();
      toast.add({ type: "success", title: "项目已删除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">短视频工坊</h1>
          <p className="text-xs text-gray-400">AI 脚本生成：选题 → 爆款标题 + 口播稿 + 分镜表</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} /> 新建项目
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-white" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Clapperboard size={32} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">还没有项目</p>
          <p className="mb-4 text-xs text-gray-400">创建一个项目，开始生成短视频脚本</p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} /> 创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
            >
              <Link href={`/video/${project.id}`} className="block">
                <div
                  className={`flex h-20 w-full items-center justify-center bg-gradient-to-br ${gradientFor(
                    project.id
                  )}`}
                >
                  <span className="text-3xl">🎬</span>
                </div>
                <div className="space-y-1.5 p-3.5">
                  <h2 className="truncate text-sm font-semibold text-gray-800">{project.name}</h2>
                  {project.positioning && (
                    <p className="line-clamp-2 text-xs text-gray-400">{project.positioning}</p>
                  )}
                  <p className="pt-1 text-[11px] text-gray-400">
                    {project.scriptCount} 个脚本 · 更新于 {formatDate(project.updatedAt)}
                  </p>
                </div>
              </Link>
              <div className="absolute top-1.5 right-1.5 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => openEdit(project)}
                  className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-blue-600"
                  title="编辑信息"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeleting(project)}
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

      <VideoCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* 编辑项目信息 */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>账号定位（可选）</Label>
              <Textarea
                value={editPositioning}
                onChange={(e) => setEditPositioning(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="如：面向小白的 AI 工具测评，目标受众是想用 AI 提效的职场人"
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
            <DialogTitle>删除项目</DialogTitle>
            <DialogDescription>
              确定删除「{deleting?.name}」吗？其下所有脚本将一并删除，无法恢复。
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
