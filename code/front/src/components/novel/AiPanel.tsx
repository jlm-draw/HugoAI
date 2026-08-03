"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { readSseStream } from "@/lib/sse";
import { cn } from "@/lib/utils";
import {
  POLISH_LABELS,
  type CharacterItem,
  type ConsistencyIssue,
  type PolishMode,
} from "@/services/novel/types";

type AiMode = "continue" | "scene" | "polish" | "dialogue" | "consistency";

const MODES: Array<{ key: AiMode; label: string }> = [
  { key: "continue", label: "续写" },
  { key: "scene", label: "场景写作" },
  { key: "polish", label: "润色" },
  { key: "dialogue", label: "对话生成" },
  { key: "consistency", label: "一致性检查" },
];

interface SelectionRange {
  from: number;
  to: number;
  text: string;
}

interface Props {
  novelId: string;
  chapterId: string;
  editor: Editor;
  characters: CharacterItem[];
}

/** 把纯文本按空行拆成 Tiptap 段落节点 */
function textToContent(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    }));
}

export function AiPanel({ novelId, chapterId, editor, characters }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>("continue");
  const [scene, setScene] = useState("");
  const [polishMode, setPolishMode] = useState<PolishMode>("style");
  const [polishNote, setPolishNote] = useState("");
  const [scenario, setScenario] = useState("");
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [output, setOutput] = useState("");
  const [issues, setIssues] = useState<ConsistencyIssue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);

  function captureSelection(): SelectionRange | null {
    const { from, to, empty } = editor.state.selection;
    if (empty) return null;
    return { from, to, text: editor.state.doc.textBetween(from, to, "\n") };
  }

  function switchMode(next: AiMode) {
    setMode(next);
    setError(null);
    setIssues(null);
    setOutput("");
    setSelection(next === "polish" || next === "continue" ? captureSelection() : null);
  }

  async function runStream(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await readSseStream(res, {
        onDelta: (t) => setOutput((o) => o + t),
        onDone: () => setBusy(false),
        onError: (m) => {
          setError(m);
          setBusy(false);
        },
      });
    } catch {
      setError("网络异常，请重试");
      setBusy(false);
    }
  }

  async function handleRun() {
    const base = `/api/novel/${novelId}/ai`;
    if (mode === "continue") {
      runStream(`${base}/continue`, { chapterId, selection: selection?.text });
    } else if (mode === "scene") {
      if (!scene.trim()) {
        setError("请描述要写的场景");
        return;
      }
      runStream(`${base}/scene`, { chapterId, scene: scene.trim() });
    } else if (mode === "polish") {
      const sel = selection ?? captureSelection();
      if (!sel) {
        setError("请先在正文中选中要润色的文字");
        return;
      }
      setSelection(sel);
      runStream(`${base}/polish`, {
        text: sel.text,
        mode: polishMode,
        note: polishNote.trim() || undefined,
      });
    } else if (mode === "dialogue") {
      if (selectedCharIds.length === 0) {
        setError("请至少勾选一个人物");
        return;
      }
      if (!scenario.trim()) {
        setError("请描述对话情境");
        return;
      }
      runStream(`${base}/dialogue`, {
        characterIds: selectedCharIds,
        scenario: scenario.trim(),
      });
    } else if (mode === "consistency") {
      setBusy(true);
      setError(null);
      setIssues(null);
      try {
        const res = await fetch(`${base}/consistency`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "检查失败");
        setIssues(json.issues);
      } catch (err) {
        setError(err instanceof Error ? err.message : "检查失败");
      } finally {
        setBusy(false);
      }
    }
  }

  function appendToEnd() {
    editor.chain().focus("end").insertContent(textToContent(output)).run();
  }

  function insertAfterSelection() {
    if (!selection) return appendToEnd();
    editor
      .chain()
      .focus()
      .setTextSelection(selection.to)
      .insertContent(textToContent(output))
      .run();
  }

  function replaceSelection() {
    if (!selection) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: selection.from, to: selection.to })
      .insertContent(textToContent(output))
      .run();
  }

  return (
    <div className="shrink-0 border-t">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
      >
        <Sparkles size={14} className="text-blue-500" />
        AI 助手
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap gap-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => switchMode(m.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  mode === m.key
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "continue" && (
            <p className="text-xs text-gray-400">
              {selection
                ? `将从选中位置（${selection.text.length} 字）之后续写`
                : "未选中文字，将从本章结尾续写"}
            </p>
          )}

          {mode === "scene" && (
            <Textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              rows={2}
              placeholder="如：主角在雨夜的城门口与故人重逢，气氛剑拔弩张…"
              maxLength={500}
            />
          )}

          {mode === "polish" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={polishMode}
                  onValueChange={(v: string | null) => v && setPolishMode(v as PolishMode)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(POLISH_LABELS) as PolishMode[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {POLISH_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={polishNote}
                  onChange={(e) => setPolishNote(e.target.value)}
                  placeholder="附加要求（可选），如：更冷峻"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-400">
                {selection
                  ? `已选中 ${selection.text.length} 字`
                  : "请先在正文中选中要润色的文字"}
              </p>
            </div>
          )}

          {mode === "dialogue" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3">
                {characters.length > 0 ? (
                  characters.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={selectedCharIds.includes(c.id)}
                        onCheckedChange={(v) =>
                          setSelectedCharIds((ids) =>
                            v ? [...ids, c.id] : ids.filter((x) => x !== c.id)
                          )
                        }
                      />
                      {c.name}
                    </label>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">请先在右侧人物面板添加人物</span>
                )}
              </div>
              <Textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={2}
                placeholder="情境，如：二人在酒楼偶遇，就师门旧事互相试探…"
                maxLength={500}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRun} disabled={busy} className="gap-1.5">
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {busy ? "生成中…" : mode === "consistency" ? "开始检查" : "生成"}
            </Button>
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>

          {output && (
            <div className="space-y-2">
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-gray-50 p-3 text-sm">
                {output}
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "polish" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={replaceSelection}
                    disabled={busy || !selection}
                  >
                    替换选中文字
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={insertAfterSelection} disabled={busy}>
                      {selection ? "插入到选中处后" : "追加到章末"}
                    </Button>
                    {selection && (
                      <Button size="sm" variant="outline" onClick={appendToEnd} disabled={busy}>
                        追加到章末
                      </Button>
                    )}
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(output)}
                >
                  <Copy size={13} /> 复制
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOutput("")}>
                  放弃
                </Button>
              </div>
            </div>
          )}

          {issues && (
            <div className="space-y-2">
              {issues.length === 0 ? (
                <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                  未发现与已有设定矛盾的内容 ✅
                </p>
              ) : (
                issues.map((issue, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                    <p className="mb-1 text-gray-700">「{issue.quote}」</p>
                    <p className="mb-1 font-medium text-amber-800">{issue.problem}</p>
                    <p className="text-gray-500">建议：{issue.suggestion}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
