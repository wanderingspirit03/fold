"use client";

import { LockKeyhole, Radio, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";

interface SecurityStripProps {
  connected: boolean;
  ready: boolean;
  recordCount: number;
  pendingCount: number;
  error?: string | null;
}

export function SecurityStrip({
  connected,
  ready,
  recordCount,
  pendingCount,
  error,
}: SecurityStripProps) {
  const state = !connected ? "offline" : !ready ? "syncing" : "live";

  return (
    <div
      className={cn(
        "border-b px-4 py-2 text-xs sm:px-6",
        error
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-studio-line bg-studio-paper/85 text-ink-muted",
      )}
    >
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <LockKeyhole className="h-3.5 w-3.5" />
          End-to-end encrypted payloads
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          {state === "offline" ? "Offline" : state === "syncing" ? "Replaying room log" : "Live private sync"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {recordCount} encrypted records
        </span>
        {pendingCount > 0 && <span>{pendingCount} suggested edits waiting</span>}
        {error && <span className="basis-full text-sm font-medium">{error}</span>}
      </div>
    </div>
  );
}
