"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Textarea } from "./ui/textarea";

interface MarkdownSourceEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  onCommit?: (markdown: string) => void;
}

export default function MarkdownSourceEditor({
  initialMarkdown,
  onChange,
  onCommit,
}: MarkdownSourceEditorProps) {
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const [markdown, setMarkdown] = useState(initialMarkdown);

  onChangeRef.current = onChange;
  onCommitRef.current = onCommit;

  const counts = useMemo(() => ({
    lines: markdown.split("\n").length,
    words: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
  }), [markdown]);

  useEffect(() => {
    setMarkdown(initialMarkdown);
  }, [initialMarkdown]);

  const handleSourceChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextMarkdown = event.target.value;
    setMarkdown(nextMarkdown);
    onChangeRef.current(nextMarkdown);
  };
  const handleSourceKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    onCommitRef.current?.(markdown);
  };

  return (
    <div
      data-editor-shell="true"
      className="overflow-hidden rounded-md border border-document-edge bg-document text-document-ink shadow-[0_4px_18px_rgba(0,0,0,0.10),0_1px_0_rgba(255,255,255,0.56)_inset]"
    >
      <div className="flex min-h-[560px] flex-col bg-document sm:min-h-[680px]">
        <Textarea
          aria-label="Markdown source"
          value={markdown}
          onChange={handleSourceChange}
          onKeyDown={handleSourceKeyDown}
          onBlur={() => onCommitRef.current?.(markdown)}
          placeholder="Write Markdown..."
          spellCheck={false}
          className="min-h-[520px] flex-1 resize-none rounded-none border-0 bg-document px-6 pb-8 pt-8 font-mono text-[13px] leading-6 text-document-ink shadow-none outline-none placeholder:text-document-subtle selection:bg-midnight-soft focus-visible:ring-0 sm:min-h-[640px] sm:px-12 sm:pt-10 lg:px-16"
        />
        <div
          data-editor-stats="true"
          aria-label={`${counts.lines} lines, ${counts.words} words`}
          className="flex items-center justify-end gap-3 border-t border-document-edge bg-document px-4 py-2 font-mono text-[11px] text-document-subtle"
        >
          <span>{counts.lines} lines</span>
          <span aria-hidden="true" className="text-document-edge">/</span>
          <span>{counts.words} words</span>
        </div>
      </div>
    </div>
  );
}
