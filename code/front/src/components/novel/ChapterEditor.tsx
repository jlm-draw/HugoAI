"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Input } from "@/components/ui/input";
import type { ChapterItem, CharacterItem } from "@/services/novel/types";
import { AiPanel } from "./AiPanel";
import { EditorToolbar } from "./EditorToolbar";

type SaveStatus = "saved" | "dirty" | "saving" | "error";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "已保存",
  dirty: "有未保存更改",
  saving: "保存中…",
  error: "保存失败",
};

/** 章节切换时长按住的未保存载荷 */
interface PendingPayload {
  title: string;
  content: unknown;
  text: string;
}

interface Props {
  novelId: string;
  chapter: ChapterItem;
  characters: CharacterItem[];
  onChapterUpdated: (
    id: string,
    patch: Partial<Pick<ChapterItem, "title" | "wordCount">>
  ) => void;
}

function normalizeContent(content: unknown): Record<string, unknown> | undefined {
  if (content && typeof content === "object" && (content as { type?: string }).type === "doc") {
    return content as Record<string, unknown>;
  }
  return undefined;
}

export function ChapterEditor({ novelId, chapter, characters, onChapterUpdated }: Props) {
  const [title, setTitle] = useState(chapter.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const titleRef = useRef(chapter.title);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef<PendingPayload | null>(null);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = payloadRef.current;
    if (!payload) return;
    payloadRef.current = null;
    setStatus("saving");
    try {
      const res = await fetch(`/api/novel/${novelId}/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      setStatus("saved");
      onChapterUpdated(chapter.id, {
        title: json.chapter.title,
        wordCount: json.chapter.wordCount,
      });
    } catch {
      payloadRef.current = payload;
      setStatus("error");
    }
  }, [novelId, chapter.id, onChapterUpdated]);

  const scheduleSave = useCallback(() => {
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(saveNow, 1500);
  }, [saveNow]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({ placeholder: "开始写作，或打开底部 AI 助手续写…" }),
    ],
    content: normalizeContent(chapter.content),
    onUpdate: ({ editor: e }) => {
      payloadRef.current = {
        title: titleRef.current,
        content: e.getJSON(),
        text: e.getText({ blockSeparator: "\n" }),
      };
      scheduleSave();
    },
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      chars: e ? (e.storage.characterCount.characters() as number) : 0,
    }),
  });

  // Ctrl+S / Cmd+S 立即保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  // 卸载 / 切换章节时冲刷未保存内容（keepalive 保证请求不被取消）
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const payload = payloadRef.current;
      if (payload) {
        payloadRef.current = null;
        fetch(`/api/novel/${novelId}/chapters/${chapter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [novelId, chapter.id]);

  if (!editor) {
    return <div className="h-full rounded-xl border bg-white" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-white">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            payloadRef.current = {
              title: e.target.value,
              content: editor.getJSON(),
              text: editor.getText({ blockSeparator: "\n" }),
            };
            scheduleSave();
          }}
          className="h-8 max-w-sm font-medium"
          maxLength={100}
        />
        <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-gray-400">
          <span>{counts ? counts.chars.toLocaleString() : chapter.wordCount.toLocaleString()} 字</span>
          <span className={status === "error" ? "text-red-500" : ""}>{STATUS_TEXT[status]}</span>
        </div>
      </div>

      <EditorToolbar editor={editor} />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} className="tiptap-wrap mx-auto max-w-3xl" />
      </div>

      <AiPanel novelId={novelId} chapterId={chapter.id} editor={editor} characters={characters} />
    </div>
  );
}
