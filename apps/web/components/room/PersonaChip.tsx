"use client";

import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";

interface PersonaChipProps {
  persona?: RoomPersona | null;
  compact?: boolean;
  className?: string;
}

export function PersonaChip({ persona, compact = false, className }: PersonaChipProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
          compact ? "h-4 w-4" : "h-6 w-6",
        )}
        style={{ backgroundColor: persona?.color || "#7e8486" }}
      >
        {persona?.name?.slice(0, 1) || "?"}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate font-medium text-ink", compact ? "text-xs" : "text-sm")}>
          {persona?.name || "Unknown"}
        </span>
        {!compact && <span className="block text-xs text-ink-subtle">{persona?.label || "Participant"}</span>}
      </span>
    </span>
  );
}
