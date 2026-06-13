"use client";

import { useEffect, useId, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
}

type RenderState =
  | { status: "loading"; svg?: never; error?: never }
  | { status: "rendered"; svg: string; error?: never }
  | { status: "error"; svg?: never; error: string };

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const rawId = useId();
  const id = `fold-mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [renderState, setRenderState] = useState<RenderState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      setRenderState({ status: "loading" });

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#f8f7f2",
            primaryBorderColor: "#8da0c8",
            primaryTextColor: "#202126",
            lineColor: "#2f5599",
            secondaryColor: "#eef2f8",
            secondaryBorderColor: "#cad0db",
            secondaryTextColor: "#202126",
            tertiaryColor: "#ffffff",
            tertiaryBorderColor: "#cad0db",
            tertiaryTextColor: "#202126",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          },
        });
        await mermaid.parse(chart);
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setRenderState({ status: "rendered", svg });
      } catch (error) {
        if (!cancelled) {
          setRenderState({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to render Mermaid diagram.",
          });
        }
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  const showSource = renderState.status === "error";

  return (
    <figure
      className="my-6 overflow-hidden rounded-md border border-document-edge bg-black/[0.025]"
      data-mermaid-diagram={renderState.status}
    >
      <figcaption className="flex items-center justify-between border-b border-document-edge px-4 py-2.5">
        <span className="font-mono text-xs text-document-muted">Mermaid</span>
        <span className="font-mono text-xs text-document-subtle">
          {renderState.status === "rendered" ? "Diagram" : renderState.status === "loading" ? "Rendering" : "Source"}
        </span>
      </figcaption>

      {renderState.status === "rendered" ? (
        <div
          className="mermaid-diagram overflow-x-auto px-4 py-5"
          aria-label="Rendered Mermaid diagram"
          // Mermaid is initialized with strict security and HTML labels disabled before producing this SVG.
          dangerouslySetInnerHTML={{ __html: renderState.svg }}
        />
      ) : null}

      {renderState.status === "loading" ? (
        <div className="px-4 py-5 text-sm text-document-subtle">Rendering diagram...</div>
      ) : null}

      {showSource ? (
        <div className="space-y-3 p-4">
          <p className="text-sm text-document-muted">{renderState.error}</p>
          <pre className="overflow-x-auto rounded-md bg-document p-3 font-mono text-xs leading-5 text-document-muted">
            {chart}
          </pre>
        </div>
      ) : null}
    </figure>
  );
}
