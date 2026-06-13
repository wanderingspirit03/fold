"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { defaultValueCtx, Editor, editorViewCtx, rootCtx, serializerCtx } from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { cursor } from "@milkdown/plugin-cursor";
import { history } from "@milkdown/plugin-history";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import type { EditorView } from "@milkdown/prose/view";
import { MessageSquarePlus, Send, X } from "lucide-react";
import { extractMarkdownProperties } from "../lib/markdown-properties";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface MilkdownReadinessLabProps {
  markdown: string;
}

type LabStatus = "loading" | "ready" | "error";

export function MilkdownReadinessLab({ markdown }: MilkdownReadinessLabProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<LabStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [selectedQuote, setSelectedQuote] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [labComments, setLabComments] = useState<Array<{ id: string; quote: string; text: string }>>([]);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const parsedMarkdown = useMemo(() => extractMarkdownProperties(markdown), [markdown]);
  const stats = useMemo(() => markdownStats(markdown), [markdown]);

  useEffect(() => {
    let disposed = false;
    let editor: Awaited<ReturnType<ReturnType<typeof Editor.make>["create"]>> | null = null;

    async function setupEditor() {
      if (!rootRef.current) return;

      try {
        setStatus("loading");
        setErrorMessage("");
        const nextEditor = await Editor.make()
          .config((ctx) => {
            ctx.set(rootCtx, rootRef.current!);
            ctx.set(defaultValueCtx, parsedMarkdown.content);
          })
          .use(commonmark)
          .use(gfm)
          .use(history)
          .use(clipboard)
          .use(cursor)
          .create();

        if (disposed) {
          await nextEditor.destroy(true);
          return;
        }

        editor = nextEditor;

        const serialized = editor.action((ctx) => {
          const view = ctx.get(editorViewCtx) as EditorView;
          const serializer = ctx.get(serializerCtx) as { (doc: EditorView["state"]["doc"]): string };
          return serializer(view.state.doc);
        });
        setExportedMarkdown(`${parsedMarkdown.propertySource}${serialized}`);
        setStatus("ready");
      } catch (error) {
        if (disposed) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }

    void setupEditor();

    return () => {
      disposed = true;
      void editor?.destroy(true);
    };
  }, [parsedMarkdown.content, parsedMarkdown.propertySource]);

  const captureMilkdownSelection = (event?: React.SyntheticEvent) => {
    const target = event?.target;
    if (target instanceof HTMLElement && target.closest("[data-milkdown-selection-probe]")) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    if (!selection || selectedText.length < 2 || !rootRef.current) {
      setSelectedQuote("");
      setCommentComposerOpen(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!rootRef.current.contains(range.commonAncestorContainer)) return;
    setSelectedQuote(selectedText.slice(0, 180));
    setCommentComposerOpen(false);
  };

  const submitLabComment = (event: React.FormEvent) => {
    event.preventDefault();
    const text = commentDraft.trim();
    const quote = selectedQuote.trim();
    if (!text || !quote) return;
    setLabComments((current) => [{ id: `lab-comment-${Date.now()}`, quote, text }, ...current]);
    setCommentDraft("");
    setCommentComposerOpen(false);
    setSelectedQuote("");
    window.getSelection()?.removeAllRanges();
  };

  return (
    <main className="min-h-dvh bg-studio text-ink">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_280px] md:px-6 md:py-6">
        <section className="min-w-0">
          <div className="mb-3 flex min-h-10 items-center justify-between gap-3 border-b border-studio-line pb-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-ink-subtle">Milkdown readiness</p>
              <h1 className="truncate text-base font-medium text-ink">Long agent handoff fixture</h1>
            </div>
            <span
              data-milkdown-status={status}
              className="shrink-0 rounded bg-studio-sunken px-2 py-1 text-xs text-ink-muted"
            >
              {status}
            </span>
          </div>
          <div
            data-milkdown-lab-editor
            onMouseUp={captureMilkdownSelection}
            onKeyUp={captureMilkdownSelection}
            className="milkdown-readiness-editor relative min-h-[620px] overflow-hidden rounded-md border border-document-edge bg-document text-document-ink shadow-[0_1px_5px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.42)_inset]"
          >
            {parsedMarkdown.properties.length > 0 && (
              <div className="border-b border-document-edge px-6 py-3 sm:px-12">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {parsedMarkdown.properties.map((property, index) => (
                    <span key={`${property.key}:${index}`} className="text-xs leading-5 text-document-subtle">
                      <span className="font-medium text-document-muted">{property.key}</span>
                      <span className="mx-1 text-document-subtle">:</span>
                      <span>{property.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div ref={rootRef} />
            {selectedQuote && (
              <div
                data-milkdown-selection-probe
                className="sticky bottom-3 z-10 mx-3 mb-3 ml-auto w-[min(360px,calc(100%-1.5rem))] rounded-md border border-midnight/25 bg-studio-paper p-2 text-ink shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
              >
                {commentComposerOpen ? (
                  <form data-milkdown-comment-composer onSubmit={submitLabComment}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-ink-subtle">
                          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
                          <span>Selection probe</span>
                        </div>
                        <p className="mt-1 line-clamp-2 border-l border-midnight/35 pl-2 text-xs leading-5 text-ink-muted">
                          {selectedQuote}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Cancel Milkdown lab comment"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                        onClick={() => {
                          setCommentComposerOpen(false);
                          setCommentDraft("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      aria-label="Milkdown lab comment"
                      placeholder="Comment"
                      rows={2}
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button type="submit" size="sm" className="h-11 md:h-8" disabled={!commentDraft.trim()}>
                        <Send className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    aria-label="Comment Milkdown selection"
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                    onClick={() => setCommentComposerOpen(true)}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs text-ink-subtle">Selection</span>
                      <span className="line-clamp-1">{selectedQuote}</span>
                    </span>
                    <MessageSquarePlus className="h-4 w-4 shrink-0 text-midnight-strong" aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 border-t border-studio-line pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div className="space-y-4">
            <section>
              <h2 className="text-xs font-medium uppercase text-ink-subtle">Fixture</h2>
              <dl className="mt-2 grid gap-2 text-sm">
                <LabMetric label="lines" value={stats.lines} />
                <LabMetric label="words" value={stats.words} />
                <LabMetric label="tables" value={stats.tables} />
                <LabMetric label="fences" value={stats.fences} />
              </dl>
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase text-ink-subtle">Gate</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                <li>Markdown remains canonical.</li>
                <li>No product editor swap.</li>
                <li>No collaboration bridge.</li>
                <li>No nested rich/source toggle.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase text-ink-subtle">Export Probe</h2>
              {status === "error" ? (
                <p className="mt-2 text-sm text-ink-muted">{errorMessage}</p>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  {exportedMarkdown ? `${markdownStats(exportedMarkdown).lines} exported lines` : "Waiting for editor"}
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase text-ink-subtle">Selection Probe</h2>
              <div data-milkdown-comment-log className="mt-2 space-y-2 text-sm text-ink-muted">
                {labComments.length === 0 ? (
                  <p>No local lab comments.</p>
                ) : (
                  labComments.map((comment) => (
                    <div key={comment.id} className="rounded border border-studio-line bg-studio-sunken/60 p-2">
                      <p className="line-clamp-2 border-l border-midnight/35 pl-2 text-xs text-ink-subtle">{comment.quote}</p>
                      <p className="mt-1 text-sm text-ink-muted">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}

function LabMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-8 items-center justify-between border-b border-studio-line">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-mono text-xs text-ink-muted">{value}</dd>
    </div>
  );
}

function markdownStats(markdown: string) {
  const trimmed = markdown.trim();
  return {
    lines: trimmed ? trimmed.split(/\r?\n/).length : 0,
    words: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
    fences: (markdown.match(/^```/gm) || []).length / 2,
    tables: markdown.split(/\r?\n/).filter((line) => /^\|.+\|$/.test(line.trim())).length,
  };
}
