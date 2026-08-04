"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VideoCreateDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [positioning, setPositioning] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPositioning("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("请填写项目名称");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/video/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          positioning: positioning.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      close();
      router.push(`/video/${json.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建短视频项目</DialogTitle>
          <DialogDescription>一个项目对应一个账号定位，AI 会结合定位生成脚本</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>项目名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：AI资讯每日解读"
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label>账号定位（可选）</Label>
            <Textarea
              value={positioning}
              onChange={(e) => setPositioning(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="目标受众、内容方向、人设…… 如：面向职场人的实用 AI 工具推荐"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={creating}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "创建中…" : "创建项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
