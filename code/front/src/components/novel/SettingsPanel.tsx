"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CharacterItem,
  ChapterItem,
  RelationItem,
  WorldSettingData,
} from "@/services/novel/types";
import { CharacterPanel } from "./CharacterPanel";
import { OutlinePanel } from "./OutlinePanel";
import { WorldSettingPanel } from "./WorldSettingPanel";

interface Props {
  novelId: string;
  worldSetting: WorldSettingData;
  characters: CharacterItem[];
  relations: RelationItem[];
  chapters: ChapterItem[];
  /** 小说简介，作为 AI 写大纲的剧情方向默认值 */
  novelDescription: string;
  onWorldSaved: (w: WorldSettingData) => void;
  onCharactersChanged: (c: CharacterItem[]) => void;
  onRelationsChanged: (r: RelationItem[]) => void;
  onSummarySaved: (id: string, summary: string) => void;
  onChaptersCreated: (chapters: ChapterItem[]) => void;
  onDeleteChapter: (id: string) => void;
}

export function SettingsPanel(props: Props) {
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-white">
      <Tabs defaultValue="world" className="flex h-full min-h-0 flex-col gap-0">
        <TabsList className="w-full shrink-0 justify-start rounded-none border-b px-2">
          <TabsTrigger value="world">世界观</TabsTrigger>
          <TabsTrigger value="characters">人物</TabsTrigger>
          <TabsTrigger value="outline">大纲</TabsTrigger>
        </TabsList>
        <TabsContent value="world" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <WorldSettingPanel
            novelId={props.novelId}
            worldSetting={props.worldSetting}
            onSaved={props.onWorldSaved}
          />
        </TabsContent>
        <TabsContent value="characters" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <CharacterPanel
            novelId={props.novelId}
            characters={props.characters}
            relations={props.relations}
            onCharactersChanged={props.onCharactersChanged}
            onRelationsChanged={props.onRelationsChanged}
          />
        </TabsContent>
        <TabsContent value="outline" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <OutlinePanel
            novelId={props.novelId}
            chapters={props.chapters}
            novelDescription={props.novelDescription}
            onSummarySaved={props.onSummarySaved}
            onChaptersCreated={props.onChaptersCreated}
          />
          {props.chapters.length > 0 && (
            <button
              onClick={() => props.onDeleteChapter(props.chapters[props.chapters.length - 1].id)}
              className="mt-3 w-full rounded-lg border border-dashed py-1.5 text-xs text-gray-400 hover:text-red-500"
            >
              删除最后一章（{props.chapters[props.chapters.length - 1].title}）
            </button>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
