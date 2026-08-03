"use client";

import type { CharacterItem, RelationItem } from "@/services/novel/types";

function looksLikeUrl(s: string): boolean {
  return /^(https?:\/\/|data:)/.test(s);
}

/** 纯 SVG 环形布局的人物关系图 */
export function RelationshipGraph({
  characters,
  relations,
}: {
  characters: CharacterItem[];
  relations: RelationItem[];
}) {
  if (characters.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-gray-400">添加人物后自动生成关系图</p>
    );
  }

  const size = 360;
  const c = size / 2;
  const radius = 125;
  const pos = new Map(
    characters.map((ch, i) => {
      const angle = (2 * Math.PI * i) / characters.length - Math.PI / 2;
      return [
        ch.id,
        { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) },
      ] as const;
    })
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[320px]">
      {relations.map((r) => {
        const a = pos.get(r.fromCharacterId);
        const b = pos.get(r.toCharacterId);
        if (!a || !b) return null;
        return (
          <g key={r.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5e7eb" strokeWidth={1.5} />
            <text
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2 - 5}
              textAnchor="middle"
              fontSize={11}
              fill="#6b7280"
            >
              {r.label}
            </text>
          </g>
        );
      })}
      {characters.map((ch) => {
        const p = pos.get(ch.id);
        if (!p) return null;
        const avatarUrl = ch.avatar && looksLikeUrl(ch.avatar) ? ch.avatar : null;
        return (
          <g key={ch.id}>
            <circle cx={p.x} cy={p.y} r={26} fill="#f3f4f6" stroke="#e5e7eb" />
            {avatarUrl ? (
              <image href={avatarUrl} x={p.x - 24} y={p.y - 24} width={48} height={48} />
            ) : (
              <text
                x={p.x}
                y={p.y + 6}
                textAnchor="middle"
                fontSize={ch.avatar ? 20 : 13}
                fill="#374151"
              >
                {ch.avatar ? ch.avatar.slice(0, 2) : ch.name.slice(0, 2)}
              </text>
            )}
            <text x={p.x} y={p.y + 44} textAnchor="middle" fontSize={12} fill="#374151">
              {ch.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
