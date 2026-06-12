"use client";

import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { PersonaAvatar } from "./PersonaAvatar";

interface PersonaChipProps {
  persona?: RoomPersona | null;
  compact?: boolean;
  className?: string;
}

export function PersonaChip({ persona, compact = false, className }: PersonaChipProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2", className)}>
      <PersonaAvatar persona={persona} compact={compact} />
      <span className="min-w-0">
        <span className={cn("block truncate font-medium text-ink", compact ? "text-xs" : "text-sm")}>
          {persona?.name || "Unknown"}
        </span>
        {!compact && <span className="block text-xs text-ink-subtle">{persona?.label || "Participant"}</span>}
      </span>
    </span>
  );
}
