"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { GENRES, type NovelSuggestion } from "@/services/novel/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NovelCreateDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [theme, setTheme] = useState("");
  const [suggestion, setSuggestion] = useState<NovelSuggestion | null>(null);
  const [applySuggestion, setApplySuggestion] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setGenre("");
    setTheme("");
    setSuggestion(null);
    setApplySuggestion(true);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSuggest() {
    if (!genre) {
      setError("请先选择小说类型");
      return;
    }
    if (!theme.trim()) {
      setError("请填写主题或创意，AI 才能生成建议");
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/novel/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, theme: theme.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成建议失败");
      setSuggestion(json.suggestion as NovelSuggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成建议失败");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("请填写小说名称");
      return;
    }
    if (!genre) {
      setError("请选择小说类型");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          genre,
          description: theme.trim() || undefined,
          setup: suggestion && applySuggestion ? suggestion : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      close();
      router.push(`/novel/${json.novel.id}`);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建小说</DialogTitle>
          <DialogDescription>
            填写基本信息，可选让 AI 根据类型与主题生成世界观和人物建议
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>小说名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：长安落雪"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label>类型</Label>
            <Select value={genre} onValueChange={(v: string | null) => setGenre(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="选择题材类型" />
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
            <Label>主题 / 创意</Label>
            <Textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={3}
              placeholder="一句话故事创意、主角设定、想要的氛围……"
              maxLength={500}
            />
          </div>

          {!suggestion && (
            <Button
              variant="outline"
              onClick={handleSuggest}
              disabled={suggesting}
              className="w-full gap-1.5"
            >
              {suggesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} className="text-blue-500" />
              )}
              {suggesting ? "AI 正在构思…" : "AI 生成世界观与人物建议"}
            </Button>
          )}

          {suggestion && (
            <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">AI 建议预览</p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="gap-1 text-blue-600"
                >
                  {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  换一个
                </Button>
              </div>
              {suggestion.world.background && (
                <p className="line-clamp-3 text-xs text-gray-600">{suggestion.world.background}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {suggestion.characters.map((c, i) => (
                  <span
                    key={i}
                    title={c.personality}
                    className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 shadow-sm"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
              <label className="flex items-center gap-1.5 pt-1 text-xs text-gray-600">
                <Checkbox
                  checked={applySuggestion}
                  onCheckedChange={(v) => setApplySuggestion(Boolean(v))}
                />
                创建时应用以上世界观与人物建议
              </label>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={creating}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "创建中…" : "创建小说"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
