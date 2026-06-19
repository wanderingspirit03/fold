import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MarkdownRenderer from "../../apps/web/components/MarkdownRenderer.js";
import { createContentSecurityPolicy } from "../../apps/web/proxy.js";

interface NextConfigWithHeaders {
  headers(): Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
}

const nextConfig = (await import("../../apps/web/next.config.js")) as unknown as NextConfigWithHeaders;

function renderMarkdown(content: string) {
  return renderToStaticMarkup(React.createElement(MarkdownRenderer, { content }));
}

describe("MarkdownRenderer security behavior", () => {
  it("does not render raw HTML tags or event attributes from room Markdown", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)><script>alert(2)</script>");

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("does not emit dangerous link hrefs", () => {
    const html = renderMarkdown("[open](javascript:alert(1))");

    expect(html).toContain("<a");
    expect(html).not.toContain("javascript:");
  });

  it("keeps math rendering through sanitized KaTeX markup", () => {
    const html = renderMarkdown("Inline math $x^2$ and block math:\n\n$$\ny = mx + b\n$$");

    expect(html).toContain("katex");
    expect(html).toContain("x");
    expect(html).toContain("y");
  });

  it("renders Mermaid fences as source placeholders without SVG insertion", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```");

    expect(html).toContain('data-mermaid-diagram="placeholder"');
    expect(html).toContain("Mermaid diagram preview is disabled in shared rooms.");
    expect(html).toContain("graph TD");
    expect(html).not.toContain("<svg");
  });
});

describe("web hardening headers", () => {
  it("configures browser hardening headers for every route", async () => {
    const configuredHeaders = await nextConfig.headers();
    const routeHeaders = configuredHeaders.find((entry) => entry.source === "/:path*")?.headers ?? [];
    const headerMap = new Map(routeHeaders.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.has("Content-Security-Policy")).toBe(false);
  });

  it("configures nonce-based CSP for hydrated production pages", () => {
    const csp = createContentSecurityPolicy("test-nonce");

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
