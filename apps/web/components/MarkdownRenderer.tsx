import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <article className="max-w-none text-ink-muted">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 mt-0 border-b border-document-edge pb-5 text-[2rem] font-semibold leading-tight tracking-normal text-ink">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-9 text-xl font-semibold tracking-normal text-ink">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="mb-2 mt-7 text-base font-semibold text-ink">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-5 text-sm font-semibold text-ink">{children}</h4>,
          p: ({ children }) => <p className="my-3.5 text-[15.5px] leading-7 text-ink-muted">{children}</p>,
          ul: ({ children }) => <ul className="my-3.5 list-disc space-y-1.5 pl-6 text-[15.5px] leading-7">{children}</ul>,
          ol: ({ children }) => <ol className="my-3.5 list-decimal space-y-1.5 pl-6 text-[15.5px] leading-7">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
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
            <blockquote className="my-5 border-l-2 border-cyan-300 bg-cyan-50/50 py-1 pl-4 text-ink-muted">{children}</blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match?.[1] ?? "";
            const isInline = !match;

            if (isInline) {
              return (
                <code className="rounded-md bg-studio-paper px-1.5 py-0.5 font-mono text-sm text-ink" {...props}>
                  {children}
                </code>
              );
            }

            if (language === "mermaid") {
              return (
                <div className="my-6 rounded-lg border border-document-edge bg-studio p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Mermaid</span>
                    <span className="text-xs text-ink-subtle">Preview disabled</span>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-document p-3 font-mono text-xs leading-5 text-ink-muted">
                    {String(children).trim()}
                  </pre>
                </div>
              );
            }

            return (
              <div className="my-6 overflow-hidden rounded-lg border border-ink bg-ink">
                <div className="border-b border-white/10 px-4 py-2 font-mono text-xs text-white/60">
                  {language || "text"}
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-white">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-6 w-full overflow-x-auto rounded-lg border border-document-edge">
              <table className="w-full border-collapse text-left text-sm text-ink-muted">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-document-edge bg-studio-paper text-ink">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-document-edge">{children}</tbody>,
          th: ({ children }) => <th className="px-4 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2">{children}</td>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4 hover:text-ink-soft">
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
