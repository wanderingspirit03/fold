"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { editMarkdownIndentation } from "../lib/markdown-source-editing";
import { Textarea } from "./ui/textarea";

interface MarkdownSourceEditorProps {
  initialMarkdown: string;
  properties?: Array<{ key: string; value: string }>;
  onChange: (markdown: string) => void;
  onCommit?: (markdown: string) => void;
}

export default function MarkdownSourceEditor({
  initialMarkdown,
  properties = [],
  onChange,
  onCommit,
}: MarkdownSourceEditorProps) {
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [tabIndents, setTabIndents] = useState(true);
  const [keyboardHint, setKeyboardHint] = useState("Tab indents Markdown. Press Escape to let Tab move focus.");

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
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "m") {
      event.preventDefault();
      setTabIndents((current) => {
        const next = !current;
        setKeyboardHint(next ? "Tab indents Markdown." : "Tab moves focus.");
        return next;
      });
      return;
    }

    if (event.key === "Escape" && tabIndents) {
      setTabIndents(false);
      setKeyboardHint("Tab moves focus.");
      return;
    }

    if (event.key === "Tab") {
      if (!tabIndents) return;
      event.preventDefault();
      const result = editMarkdownIndentation(
        markdown,
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
        event.shiftKey ? "outdent" : "indent",
      );
      setMarkdown(result.value);
      onChangeRef.current(result.value);
      window.requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
      return;
    }

    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    onCommitRef.current?.(markdown);
  };

  return (
    <div
      data-editor-shell="true"
      className="overflow-hidden rounded-md border border-document-edge bg-document text-document-ink shadow-[0_4px_18px_rgba(0,0,0,0.10),0_1px_0_rgba(255,255,255,0.56)_inset]"
    >
      <div className="relative flex min-h-[560px] flex-col bg-document sm:min-h-[680px]">
        {properties.length > 0 && (
          <div className="border-b border-document-edge bg-black/[0.018] px-6 py-3 sm:px-12 lg:px-16">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {properties.map((property, index) => (
                <span key={`${property.key}:${index}`} className="text-xs leading-5 text-document-subtle">
                  <span className="font-medium text-document-muted">{property.key}</span>
                  <span className="mx-1 text-document-subtle">:</span>
                  <span>{property.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          aria-label="Markdown source"
          aria-describedby="markdown-source-keyboard-hint"
          value={markdown}
          onChange={handleSourceChange}
          onKeyDown={handleSourceKeyDown}
          onBlur={() => {
            setTabIndents(true);
            setKeyboardHint("Tab indents Markdown. Press Escape to let Tab move focus.");
            onCommitRef.current?.(markdown);
          }}
          placeholder="Write Markdown..."
          spellCheck={false}
          className="min-h-[560px] flex-1 resize-none rounded-none border-0 bg-document px-6 pb-14 pt-8 font-mono text-[13px] leading-6 text-document-ink shadow-none outline-none placeholder:text-document-subtle selection:bg-midnight-soft focus-visible:ring-0 sm:min-h-[680px] sm:px-12 sm:pt-10 lg:px-16"
        />
        <span id="markdown-source-keyboard-hint" className="sr-only">
          {keyboardHint}
        </span>
        <div
          data-editor-stats="true"
          aria-label={`${counts.lines} lines, ${counts.words} words`}
          className="pointer-events-none absolute bottom-3 right-4 flex items-center justify-end gap-2 rounded bg-document/85 px-1.5 py-0.5 font-mono text-[11px] text-document-subtle sm:right-6 lg:right-10"
        >
          <span className="flex shrink-0 items-center gap-2">
            <span>{counts.lines} lines</span>
            <span aria-hidden="true" className="text-document-edge">/</span>
            <span>{counts.words} words</span>
          </span>
        </div>
      </div>
    </div>
  );
}
