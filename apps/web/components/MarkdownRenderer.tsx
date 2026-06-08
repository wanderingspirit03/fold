import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

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
            return <input type={type} checked={checked} {...props} />;
          },
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-2 border-midnight-strong bg-midnight-soft py-1 pl-4 text-document-muted">{children}</blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match?.[1] ?? "";
            const isInline = !match;

            if (isInline) {
              return (
                <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-sm text-document-ink" {...props}>
                  {children}
                </code>
              );
            }

            if (language === "mermaid") {
              return (
                <div className="my-6 rounded-md border border-document-edge bg-black/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-document-muted">Mermaid</span>
                    <span className="text-xs text-document-subtle">Preview disabled</span>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-document p-3 font-mono text-xs leading-5 text-document-muted">
                    {String(children).trim()}
                  </pre>
                </div>
              );
            }

            return (
              <div className="my-6 overflow-hidden rounded-md border border-studio-line bg-studio">
                <div className="border-b border-studio-line px-4 py-2 font-mono text-xs text-ink-subtle">
                  {language || "text"}
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-ink">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-6 w-full overflow-x-auto rounded-lg border border-document-edge">
              <table className="w-full border-collapse text-left text-sm text-document-muted">{children}</table>
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
  const base = "inline cursor-pointer rounded-[2px] px-px text-left text-document-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong";
  const activeClass = active ? "bg-midnight-soft shadow-[0_0_0_2px_hsl(var(--midnight-soft))] ring-1 ring-midnight-strong/45" : "";
  if (kind === "suggestion") {
    const opacity = status === "accepted" || status === "rejected" ? "opacity-70" : "";
    return `${base} ${activeClass} ${opacity} border-b-2 border-dashed border-midnight/50 ${active ? "" : "bg-transparent hover:bg-midnight-soft"}`;
  }
  return `${base} ${activeClass} border-b-2 border-midnight/45 ${active ? "" : "bg-transparent hover:bg-midnight-soft"}`;
}
