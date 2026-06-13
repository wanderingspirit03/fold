import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MermaidDiagram } from "./MermaidDiagram";

interface MarkdownRendererProps {
  content: string;
  activeTextHighlightId?: string | null;
  textHighlights?: Array<{
    id: string;
    text: string;
    label: string;
    kind?: "comment" | "suggestion";
    status?: "pending" | "accepted" | "rejected";
    before?: string;
    after?: string;
  }>;
  onTextHighlightClick?: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function MarkdownRenderer({
  content,
  activeTextHighlightId = null,
  textHighlights = [],
  onTextHighlightClick,
}: MarkdownRendererProps) {
  return (
    <article className="max-w-none text-document-muted">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 mt-0 border-b border-document-edge pb-5 text-[2rem] font-semibold leading-tight tracking-normal text-document-ink">
              {renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-9 text-xl font-semibold tracking-normal text-document-ink">
              {renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-7 text-base font-semibold text-document-ink">
              {renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-5 text-sm font-semibold text-document-ink">
              {renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-3.5 text-[15.5px] leading-7 text-document-muted">
              {renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}
            </p>
          ),
          ul: ({ children }) => <ul className="my-3.5 list-disc space-y-1.5 pl-6 text-[15.5px] leading-7">{children}</ul>,
          ol: ({ children }) => <ol className="my-3.5 list-decimal space-y-1.5 pl-6 text-[15.5px] leading-7">{children}</ol>,
          li: ({ children }) => (
            <li className="pl-1">{renderWithInlineComments(children, textHighlights, activeTextHighlightId, onTextHighlightClick)}</li>
          ),
          input: ({ type, checked, ...props }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  disabled
                  className="mr-2 h-4 w-4 rounded border-line-soft align-[-2px]"
                />
              );
            }
            const { node: _node, ref: _ref, ...inputProps } = props as React.InputHTMLAttributes<HTMLInputElement> & {
              node?: unknown;
              ref?: unknown;
            };
            return <input type={type} checked={checked} {...inputProps} />;
          },
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-2 border-midnight-strong/70 bg-black/[0.025] py-1.5 pl-4 pr-3 text-document-muted">{children}</blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const { node: _node, ref: _ref, ...codeProps } = props as React.HTMLAttributes<HTMLElement> & {
              node?: unknown;
              ref?: unknown;
            };
            const match = /language-(\w+)/.exec(className || "");
            const language = match?.[1] ?? "";
            const isInline = !match;

            if (isInline) {
              return (
                <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-sm text-document-ink" {...codeProps}>
                  {children}
                </code>
              );
            }

            if (language === "mermaid") {
              return <MermaidDiagram chart={String(children).trim()} />;
            }

            return (
              <div className="my-6 overflow-hidden rounded-md border border-studio-line bg-studio">
                <div className="border-b border-studio-line px-4 py-2 font-mono text-xs text-ink-subtle">
                  {language || "text"}
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-ink">
                  <code className={className} {...codeProps}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-6 w-full overflow-x-auto rounded-lg border border-document-edge">
              <table className="min-w-[620px] border-collapse text-left text-sm text-document-muted md:w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-document-edge bg-black/[0.04] text-document-ink">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-document-edge">{children}</tbody>,
          th: ({ children }) => <th className="px-4 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2">{children}</td>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-midnight underline underline-offset-4 hover:text-midnight-strong">
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-document-edge" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function renderWithInlineComments(
  children: React.ReactNode,
  highlights: NonNullable<MarkdownRendererProps["textHighlights"]>,
  activeTextHighlightId: MarkdownRendererProps["activeTextHighlightId"],
  onTextHighlightClick?: MarkdownRendererProps["onTextHighlightClick"],
) {
  if (highlights.length === 0) return children;

  return React.Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return renderStringWithInlineComments(child, highlights, activeTextHighlightId, onTextHighlightClick);
  });
}

function renderStringWithInlineComments(
  text: string,
  highlights: NonNullable<MarkdownRendererProps["textHighlights"]>,
  activeTextHighlightId: MarkdownRendererProps["activeTextHighlightId"],
  onTextHighlightClick?: MarkdownRendererProps["onTextHighlightClick"],
) {
  const matches = highlights
    .map((highlight) => findHighlightMatch(text, highlight))
    .filter((match): match is HighlightMatch => Boolean(match))
    .sort((a, b) => a.start - b.start || b.score - a.score);

  if (matches.length === 0) return text;

  const nonOverlapping: HighlightMatch[] = [];
  for (const match of matches) {
    if (nonOverlapping.some((existing) => rangesOverlap(existing, match))) continue;
    nonOverlapping.push(match);
  }
  nonOverlapping.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of nonOverlapping) {
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    const highlightedText = text.slice(match.start, match.end);
    const kind = match.highlight.kind ?? "comment";
    const active = activeTextHighlightId === match.highlight.id;
    parts.push(
      <button
        key={`${match.highlight.id}-${match.start}`}
        type="button"
        data-inline-comment-marker
        title={match.highlight.label}
        aria-label={`Open inline ${match.highlight.label.toLowerCase()} for ${truncateForLabel(highlightedText)}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onTextHighlightClick?.(match.highlight.id, event);
        }}
        className={inlineMarkerClassName(kind, match.highlight.status, active)}
      >
        {highlightedText}
      </button>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}

interface HighlightMatch {
  start: number;
  end: number;
  score: number;
  highlight: NonNullable<MarkdownRendererProps["textHighlights"]>[number];
}

function findHighlightMatch(
  text: string,
  highlight: NonNullable<MarkdownRendererProps["textHighlights"]>[number],
): HighlightMatch | null {
  const exactNeedle = highlight.text.replace(/\s+/g, " ").trim();
  if (exactNeedle.length <= 1) return null;

  const exactIndex = text.indexOf(exactNeedle);
  if (exactIndex >= 0) {
    return {
      start: exactIndex,
      end: exactIndex + exactNeedle.length,
      score: contextScore(text, highlight),
      highlight,
    };
  }

  const fallbackNeedle = exactNeedle.slice(0, 48);
  if (fallbackNeedle.length <= 8) return null;

  const fallbackIndex = text.indexOf(fallbackNeedle);
  if (fallbackIndex < 0) return null;

  return {
    start: fallbackIndex,
    end: fallbackIndex + fallbackNeedle.length,
    score: contextScore(text, highlight) - 1,
    highlight,
  };
}

function contextScore(
  text: string,
  highlight: NonNullable<MarkdownRendererProps["textHighlights"]>[number],
) {
  const normalizedText = normalizeWhitespace(text);
  const before = normalizeWhitespace(highlight.before || "").slice(-40);
  const after = normalizeWhitespace(highlight.after || "").slice(0, 40);
  let score = 0;
  if (before && normalizedText.includes(before)) score += 1;
  if (after && normalizedText.includes(after)) score += 1;
  return score;
}

function rangesOverlap(a: HighlightMatch, b: HighlightMatch) {
  return a.start < b.end && b.start < a.end;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateForLabel(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 56 ? `${normalized.slice(0, 53)}...` : normalized;
}

function inlineMarkerClassName(
  kind: NonNullable<NonNullable<MarkdownRendererProps["textHighlights"]>[number]["kind"]>,
  status?: NonNullable<MarkdownRendererProps["textHighlights"]>[number]["status"],
  active = false,
) {
  const base = [
    "relative inline cursor-pointer box-decoration-clone rounded-[2px] px-px text-left text-document-ink transition-colors touch-manipulation",
    "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
  ].join(" ");
  const activeClass = active ? "bg-midnight-soft shadow-[0_0_0_2px_hsl(var(--midnight-soft))] ring-1 ring-midnight-strong/45" : "";
  if (kind === "suggestion") {
    const resolved = status === "accepted" || status === "rejected";
    const resolvedClass = resolved
      ? "border-b border-dashed border-midnight/45 bg-transparent opacity-70 hover:bg-midnight-soft"
      : "border-b-2 border-midnight/65 bg-midnight-mark shadow-[inset_0_-1px_0_hsl(var(--midnight-soft))] hover:bg-midnight-soft after:ml-1 after:inline-block after:h-1.5 after:w-1.5 after:rounded-full after:bg-midnight-strong after:align-middle after:content-['']";
    return `${base} ${resolvedClass} ${activeClass}`;
  }
  return `${base} border-b border-midnight/45 bg-midnight-mark shadow-[inset_0_-1px_0_hsl(var(--midnight-soft))] hover:bg-midnight-soft ${activeClass}`;
}
