"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterItem } from "@/services/novel/types";

export interface CharacterFormValues {
  name: string;
  avatar: string;
  personality: string;
  background: string;
}

interface Props {
  open: boolean;
  character: CharacterItem | null;
  onClose: () => void;
  onSubmit: (values: CharacterFormValues) => void;
}

export function CharacterDialog({ open, character, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [personality, setPersonality] = useState("");
  const [background, setBackground] = useState("");

  // 打开目标变化时在渲染期重置表单（避免 effect 同步 setState）
  const dialogKey = open ? (character?.id ?? "new") : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (dialogKey !== lastKey) {
    setLastKey(dialogKey);
    if (dialogKey !== null) {
      setName(character?.name ?? "");
      setAvatar(character?.avatar ?? "");
      setPersonality(character?.personality ?? "");
      setBackground(character?.background ?? "");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{character ? "编辑人物" : "新建人物"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>姓名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label>头像（emoji 或图片 URL，可选）</Label>
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="🗡️ 或 https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>性格</Label>
            <Textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
              placeholder="如：外冷内热，重诺轻生…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>背景</Label>
            <Textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={3}
              placeholder="出身、经历、动机…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onSubmit({
                name: name.trim(),
                avatar: avatar.trim(),
                personality: personality.trim(),
                background: background.trim(),
              });
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
