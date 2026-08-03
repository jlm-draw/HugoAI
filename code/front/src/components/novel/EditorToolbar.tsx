"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  TextQuote,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  if (!state) return null;

  const items = [
    { key: "bold", icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: "strike", icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { key: "h1", icon: Heading1, active: state.h1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", icon: Heading2, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "bullet", icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "ordered", icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "quote", icon: TextQuote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-3 py-1.5">
      {items.map(({ key, icon: Icon, active, run }) => (
        <Button
          key={key}
          variant="ghost"
          size="icon-xs"
          onClick={run}
          className={cn(active && "bg-blue-50 text-blue-600")}
        >
          <Icon size={13} />
        </Button>
      ))}
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={13} />
        </Button>
      </div>
    </div>
  );
}
