"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { WorldSettingData } from "@/services/novel/types";

interface Props {
  novelId: string;
  worldSetting: WorldSettingData;
  onSaved: (w: WorldSettingData) => void;
}

const FIELDS: Array<{ key: keyof WorldSettingData; label: string; placeholder: string }> = [
  { key: "background", label: "背景设定", placeholder: "世界的基本面貌、力量体系、社会结构…" },
  { key: "timeline", label: "时间线", placeholder: "重大历史事件与时间节点…" },
  { key: "geography", label: "地理设定", placeholder: "大陆、国家、重要地点…" },
];

export function WorldSettingPanel({ novelId, worldSetting, onSaved }: Props) {
  const [form, setForm] = useState<WorldSettingData>(worldSetting);
  const [saving, setSaving] = useState(false);

  // props 变化时在渲染期同步本地表单（React 官方「渲染期调整状态」模式，避免 effect 同步 setState）
  const [prevWorld, setPrevWorld] = useState(worldSetting);
  if (prevWorld !== worldSetting) {
    setPrevWorld(worldSetting);
    setForm(worldSetting);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/novel/${novelId}/world`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "保存失败");
      }
      onSaved(form);
      toast.add({ type: "success", title: "世界观已保存" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Textarea
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            rows={4}
            className="text-xs"
          />
        </div>
      ))}
      <Button onClick={save} disabled={saving} className="w-full" size="sm">
        {saving ? "保存中…" : "保存世界观"}
      </Button>
    </div>
  );
}
