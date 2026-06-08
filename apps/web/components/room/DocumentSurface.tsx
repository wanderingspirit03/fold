"use client";

import { useRef, useState } from "react";
import { FileText, PenLine } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";
import MarkdownTextareaEditor from "../MarkdownTextareaEditor";
import { cn } from "../../lib/utils";
import { SelectionAnchor } from "./SelectionAnchor";
import type { RoomMode } from "./types";

interface DocumentSurfaceProps {
  mode: RoomMode;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  selectedQuote: string;
  onSelectedQuoteChange: (quote: string) => void;
  onAddNoteAtSelection: () => void;
  onAskAgentAtSelection: () => void;
}

export function DocumentSurface({
  mode,
  markdown,
  onMarkdownChange,
  selectedQuote,
  onSelectedQuoteChange,
  onAddNoteAtSelection,
  onAskAgentAtSelection,
}: DocumentSurfaceProps) {
  const readSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<{ top: number; left: number } | null>(null);

  const captureSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    if (!selection || selectedText.length < 2 || !readSurfaceRef.current) {
      setAnchorPoint(null);
      onSelectedQuoteChange("");
      return;
    }

    const range = selection.getRangeAt(0);
    if (!readSurfaceRef.current.contains(range.commonAncestorContainer)) return;

    const rangeRect = range.getBoundingClientRect();
    const surfaceRect = readSurfaceRef.current.getBoundingClientRect();
    onSelectedQuoteChange(selectedText.slice(0, 180));
    setAnchorPoint({
      top: Math.max(20, rangeRect.top - surfaceRect.top - 8),
      left: Math.min(surfaceRect.width - 284, Math.max(16, rangeRect.right - surfaceRect.left + 16)),
    });
  };

  if (mode === "edit") {
    return (
      <section className="mx-auto w-full max-w-4xl">
        <MarkdownTextareaEditor initialMarkdown={markdown} onChange={onMarkdownChange} />
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-studio-line bg-studio-paper px-3 py-2 text-sm text-ink-muted">
          <PenLine className="h-4 w-4 text-ink-subtle" />
          Markdown remains the canonical encrypted document state.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink-subtle">
        <span>Document</span>
        <span className="text-right">Select text to start a margin thread</span>
      </div>
      <div
        ref={readSurfaceRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className={cn(
          "relative min-h-[520px] rounded-[10px] border border-document-edge bg-document px-6 py-8 sm:min-h-[680px]",
          "shadow-[0_18px_60px_rgba(50,43,34,0.10),0_1px_0_rgba(255,255,255,0.8)_inset]",
          "selection:bg-cyan-100 selection:text-ink sm:px-12 lg:px-16",
        )}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-full w-3 border-l border-dashed border-studio-line/70 bg-studio-paper/45 sm:w-7 sm:bg-studio-paper/55" />
        {markdown.trim() ? (
          <MarkdownRenderer content={markdown} />
        ) : (
          <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-studio-line bg-studio-paper text-ink-subtle">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-ink">Empty Markdown document</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
              Switch to edit mode to write the first encrypted room draft.
            </p>
          </div>
        )}
        {selectedQuote && anchorPoint && (
          <div
            className="absolute z-10 hidden lg:block"
            style={{ top: anchorPoint.top, left: anchorPoint.left }}
          >
            <SelectionAnchor
              quote={selectedQuote}
              onAddNote={onAddNoteAtSelection}
              onAskAgent={onAskAgentAtSelection}
            />
          </div>
        )}
      </div>
    </section>
  );
}
