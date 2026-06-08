"use client";

import { ArrowLeft, Download, FileText, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { PersonaChip } from "./PersonaChip";
import { SecurityStrip } from "./SecurityStrip";
import type { RoomMode } from "./types";

interface RoomShellProps {
  roomId: string;
  connected: boolean;
  ready: boolean;
  recordCount: number;
  pendingCount: number;
  persona?: RoomPersona | null;
  mode: RoomMode;
  error?: string | null;
  onBack: () => void;
  onExport: () => void;
  onModeChange: (mode: RoomMode) => void;
  document: ReactNode;
  bench: ReactNode;
}

export function RoomShell({
  roomId,
  connected,
  ready,
  recordCount,
  pendingCount,
  persona,
  mode,
  error,
  onBack,
  onExport,
  onModeChange,
  document,
  bench,
}: RoomShellProps) {
  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-studio text-ink">
        <header className="sticky top-0 z-30 border-b border-studio-line bg-studio/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-studio-line bg-document font-mono text-xs font-semibold text-ink">
                    MD
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate font-mono text-sm font-semibold text-ink">{roomId?.slice(0, 14)}</h1>
                    <p className="truncate text-xs text-ink-muted">Encrypted Markdown room</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden rounded-lg border border-studio-line bg-document p-1 sm:flex">
              <ModeButton active={mode === "read"} onClick={() => onModeChange("read")}>
                <FileText className="h-3.5 w-3.5" />
                Read
              </ModeButton>
              <ModeButton active={mode === "edit"} onClick={() => onModeChange("edit")}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </ModeButton>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex rounded-lg border border-studio-line bg-document p-0.5 sm:hidden">
                <ModeIconButton
                  active={mode === "read"}
                  label="Read mode"
                  onClick={() => onModeChange("read")}
                >
                  <FileText className="h-3.5 w-3.5" />
                </ModeIconButton>
                <ModeIconButton
                  active={mode === "edit"}
                  label="Edit mode"
                  onClick={() => onModeChange("edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </ModeIconButton>
              </div>
              {persona && <PersonaChip persona={persona} compact className="hidden sm:inline-flex" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onExport} aria-label="Export Markdown">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Markdown</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <SecurityStrip
            connected={connected}
            ready={ready}
            recordCount={recordCount}
            pendingCount={pendingCount}
            error={error}
          />
        </header>

        <div className="grid min-h-[calc(100dvh-105px)] lg:grid-cols-[minmax(0,1fr)_390px]">
          <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">{document}</main>
          {bench}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ModeIconButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
        active ? "bg-ink text-white shadow-sm" : "text-ink-muted hover:bg-studio-paper hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
        active ? "bg-ink text-white shadow-sm" : "text-ink-muted hover:bg-studio-paper hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
