"use client";

import { CornerDownRight, MessageSquarePlus } from "lucide-react";
import { Button } from "../ui/button";

interface SelectionAnchorProps {
  quote: string;
  onAddNote: () => void;
  onAskAgent: () => void;
}

export function SelectionAnchor({ quote, onAddNote, onAskAgent }: SelectionAnchorProps) {
  return (
    <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 shadow-[0_12px_32px_rgba(36,48,52,0.14)]">
      <div className="mb-2 max-w-[260px] truncate text-xs text-ink-muted">
        <span className="text-ink-subtle">Selected</span> "{quote}"
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={onAddNote}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add note here
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onAskAgent}>
          <CornerDownRight className="h-3.5 w-3.5" />
          Ask agent
        </Button>
      </div>
    </div>
  );
}
