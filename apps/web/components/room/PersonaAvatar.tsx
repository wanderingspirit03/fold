"use client";

import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";

interface PersonaAvatarProps {
  persona?: RoomPersona | null;
  compact?: boolean;
  className?: string;
}

export function PersonaAvatar({ persona, compact = false, className }: PersonaAvatarProps) {
  const seed = persona ? hashString(`${persona.id}:${persona.kind}:${persona.name}`) : 0;
  const isAgent = persona?.kind === "agent";
  const accent = persona?.color || "#64748b";
  const sizeClass = compact ? "h-4 w-4" : "h-6 w-6";
  const glyph = abstractGlyph(seed, isAgent);
  const gradientId = `persona-gradient-${seed.toString(36)}`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-studio-sunken shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
        sizeClass,
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-full w-full" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="6" x2="26" y1="5" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor={accent} />
            <stop offset="1" stopColor="hsl(var(--midnight-strong))" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="16" fill={`url(#${gradientId})`} opacity="0.94" />
        <path d={glyph.base} fill="rgba(0,0,0,0.18)" />
        <path
          d={glyph.loop}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={isAgent ? "2.4" : "2.1"}
        />
        <path
          d={glyph.echo}
          fill="none"
          stroke="rgba(255,255,255,0.34)"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
        <circle cx={glyph.node.x} cy={glyph.node.y} r={glyph.node.r} fill="rgba(255,255,255,0.86)" />
        {isAgent ? (
          <rect
            x={glyph.signal.x}
            y={glyph.signal.y}
            width={glyph.signal.size}
            height={glyph.signal.size}
            rx="1.2"
            fill="rgba(255,255,255,0.72)"
          />
        ) : null}
      </svg>
    </span>
  );
}

function abstractGlyph(seed: number, isAgent: boolean) {
  const variant = seed % 5;
  const drift = ((seed >>> 3) % 5) - 2;
  const node = {
    x: 10 + ((seed >>> 7) % 13),
    y: 9 + ((seed >>> 11) % 13),
    r: 1.45 + ((seed >>> 13) % 3) * 0.2,
  };
  const signal = {
    x: 18 + ((seed >>> 17) % 4),
    y: 8 + ((seed >>> 19) % 5),
    size: 3.2 + ((seed >>> 23) % 2),
  };

  if (isAgent) {
    const base = [
      `M6 ${17 + drift}c3-9 13-13 20-7 2 7-2 14-10 16-8-2-12-7-10-9z`,
      `M8 ${10 + drift}c8-5 17-1 18 8-4 7-13 9-20 4-2-5 0-10 2-12z`,
      `M7 ${22 + drift}c1-9 8-17 17-14 5 4 6 12 0 17-7 2-13 0-17-3z`,
      `M5 ${15 + drift}c6-9 18-9 22 1-2 8-10 13-19 10-5-3-6-7-3-11z`,
      `M9 ${8 + drift}c9-2 18 4 16 14-6 6-15 5-20-2-1-6 1-10 4-12z`,
    ][variant];
    const loop = [
      `M9 ${18 + drift}c4-6 10-7 15-2`,
      `M10 ${12 + drift}c5 2 8 7 5 13`,
      `M12 ${22 + drift}c-1-7 3-12 10-13`,
      `M8 ${16 + drift}c5-3 11-2 16 3`,
      `M11 ${11 + drift}c5 0 10 4 10 10`,
    ][variant];
    const echo = [
      `M11 ${23 + drift}c4 2 9 1 12-2`,
      `M8 ${21 + drift}c4 3 10 4 15 1`,
      `M8 ${15 + drift}c4-3 8-4 13-3`,
      `M12 ${24 + drift}c5 0 9-2 12-6`,
      `M8 ${19 + drift}c3 4 9 6 15 4`,
    ][variant];
    return { base, loop, echo, node, signal };
  }

  const base = [
    `M7 ${16 + drift}c2-8 10-13 18-9 4 7 0 15-8 18-8-1-13-6-10-9z`,
    `M8 ${10 + drift}c7-4 15-1 18 6-1 8-9 14-17 11-5-4-4-13-1-17z`,
    `M6 ${21 + drift}c1-10 10-17 18-12 4 6 2 14-6 17-7 0-13-2-12-5z`,
    `M6 ${15 + drift}c5-8 16-10 21-2-1 8-9 15-18 13-6-2-8-7-3-11z`,
    `M9 ${8 + drift}c8-3 17 4 16 13-5 7-15 8-20 1-2-5-1-10 4-14z`,
  ][variant];
  const loop = [
    `M10 ${17 + drift}c4-4 10-5 14-1`,
    `M10 ${12 + drift}c4 2 7 6 6 11`,
    `M11 ${22 + drift}c0-6 4-11 10-12`,
    `M8 ${16 + drift}c5-3 11-1 15 3`,
    `M11 ${11 + drift}c5 0 9 4 9 9`,
  ][variant];
  const echo = [
    `M11 ${23 + drift}c4 2 8 1 12-2`,
    `M8 ${21 + drift}c4 3 10 3 14 1`,
    `M8 ${15 + drift}c4-3 8-4 13-2`,
    `M12 ${24 + drift}c4 0 8-2 11-5`,
    `M8 ${19 + drift}c3 4 9 5 14 3`,
  ][variant];
  return { base, loop, echo, node, signal };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
