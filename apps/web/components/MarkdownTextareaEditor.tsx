"use client";

import React, { useEffect, useRef, useState } from "react";
import { Eye, FileText, Pencil } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface MarkdownTextareaEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

export default function MarkdownTextareaEditor({
  initialMarkdown,
  onChange,
}: MarkdownTextareaEditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setMarkdown(initialMarkdown);
  }, [initialMarkdown]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setMarkdown(next);
    onChangeRef.current(next);
  };

  const lineCount = markdown.split("\n").length;
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-[560px] w-full flex-col overflow-hidden rounded-xl border border-line-soft bg-white shadow-[0_0_18px_rgba(208,214,215,0.28)]">
      <div className="flex items-center justify-between border-b border-line-soft bg-bone px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={tab === "write" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setTab("write")}
          >
            <Pencil className="h-3.5 w-3.5" />
            Write
          </Button>
          <Button
            type="button"
            variant={tab === "preview" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setTab("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <FileText className="h-3.5 w-3.5" />
          <span>{lineCount} lines</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      {tab === "write" ? (
        <Textarea
          className="min-h-[520px] flex-1 resize-none rounded-none border-0 bg-white p-5 font-mono text-sm leading-6 shadow-none focus-visible:ring-0"
          placeholder="# Write Markdown"
          value={markdown}
          onChange={handleTextChange}
        />
      ) : (
        <div className="max-h-[560px] flex-1 overflow-y-auto p-8">
          <MarkdownRenderer content={markdown} />
        </div>
      )}
    </div>
  );
}
