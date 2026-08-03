"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { CharacterItem, RelationItem } from "@/services/novel/types";
import { CharacterDialog, type CharacterFormValues } from "./CharacterDialog";
import { RelationshipGraph } from "./RelationshipGraph";

interface Props {
  novelId: string;
  characters: CharacterItem[];
  relations: RelationItem[];
  onCharactersChanged: (c: CharacterItem[]) => void;
  onRelationsChanged: (r: RelationItem[]) => void;
}

function looksLikeUrl(s: string): boolean {
  return /^(https?:\/\/|data:)/.test(s);
}

export function CharacterPanel({
  novelId,
  characters,
  relations,
  onCharactersChanged,
  onRelationsChanged,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<CharacterItem | null>(null);
  const [relFrom, setRelFrom] = useState<string>("");
  const [relTo, setRelTo] = useState<string>("");
  const [relLabel, setRelLabel] = useState("");

  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? "未知";

  async function submitCharacter(values: CharacterFormValues) {
    const url = editingChar
      ? `/api/novel/${novelId}/characters/${editingChar.id}`
      : `/api/novel/${novelId}/characters`;
    try {
      const res = await fetch(url, {
        method: editingChar ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      if (editingChar) {
        onCharactersChanged(characters.map((c) => (c.id === editingChar.id ? json.character : c)));
      } else {
        onCharactersChanged([...characters, json.character]);
      }
      setDialogOpen(false);
      setEditingChar(null);
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    }
  }

  async function deleteCharacter(ch: CharacterItem) {
    if (!confirm(`确定删除人物「${ch.name}」吗？其关系也会一并删除。`)) return;
    try {
      const res = await fetch(`/api/novel/${novelId}/characters/${ch.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      onCharactersChanged(characters.filter((c) => c.id !== ch.id));
      onRelationsChanged(
        relations.filter((r) => r.fromCharacterId !== ch.id && r.toCharacterId !== ch.id)
      );
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  async function addRelation() {
    if (!relFrom || !relTo || !relLabel.trim()) {
      toast.add({ type: "warning", title: "请选择两个人物并填写关系" });
      return;
    }
    try {
      const res = await fetch(`/api/novel/${novelId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCharacterId: relFrom,
          toCharacterId: relTo,
          label: relLabel.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "添加失败");
      onRelationsChanged([...relations, json.relation]);
      setRelLabel("");
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "添加失败" });
    }
  }

  async function deleteRelation(rid: string) {
    try {
      const res = await fetch(`/api/novel/${novelId}/relations/${rid}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      onRelationsChanged(relations.filter((r) => r.id !== rid));
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  return (
    <div className="space-y-3">
      <RelationshipGraph characters={characters} relations={relations} />

      {characters.map((ch) => {
        const rels = relations.filter(
          (r) => r.fromCharacterId === ch.id || r.toCharacterId === ch.id
        );
        return (
          <div key={ch.id} className="rounded-lg border p-2.5">
            <div className="mb-1 flex items-center gap-2">
              {ch.avatar && looksLikeUrl(ch.avatar) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ch.avatar} alt={ch.name} className="size-7 rounded-full object-cover" />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm">
                  {ch.avatar || ch.name.slice(0, 1)}
                </span>
              )}
              <span className="flex-1 truncate text-sm font-medium">{ch.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setEditingChar(ch);
                  setDialogOpen(true);
                }}
              >
                <Pencil size={12} />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => deleteCharacter(ch)}>
                <Trash2 size={12} />
              </Button>
            </div>
            {ch.personality && <p className="text-xs text-gray-500">性格：{ch.personality}</p>}
            {ch.background && <p className="text-xs text-gray-500">背景：{ch.background}</p>}
            {rels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rels.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {r.fromCharacterId === ch.id
                      ? `→ ${r.label} → ${nameOf(r.toCharacterId)}`
                      : `← ${r.label} ← ${nameOf(r.fromCharacterId)}`}
                    <button
                      onClick={() => deleteRelation(r.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-2 rounded-lg border border-dashed p-2.5">
        <p className="text-xs font-medium text-gray-500">添加关系</p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={relFrom || null} onValueChange={(v: string | null) => setRelFrom(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="人物 A" />
            </SelectTrigger>
            <SelectContent>
              {characters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={relTo || null} onValueChange={(v: string | null) => setRelTo(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="人物 B" />
            </SelectTrigger>
            <SelectContent>
              {characters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            value={relLabel}
            onChange={(e) => setRelLabel(e.target.value)}
            placeholder="关系，如：师徒 / 宿敌"
            className="h-7 text-xs"
            maxLength={30}
          />
          <Button size="icon-sm" variant="outline" onClick={addRelation} disabled={characters.length < 2}>
            <Plus size={12} />
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => {
          setEditingChar(null);
          setDialogOpen(true);
        }}
      >
        <Plus size={13} /> 新建人物
      </Button>

      <CharacterDialog
        open={dialogOpen}
        character={editingChar}
        onClose={() => {
          setDialogOpen(false);
          setEditingChar(null);
        }}
        onSubmit={submitCharacter}
      />
    </div>
  );
}
