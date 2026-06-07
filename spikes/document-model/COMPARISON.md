# Document Model Comparison Report

This report shows the same agent-authored Markdown samples through both candidate document models.

- Markdown canonical keeps raw Markdown as the live `Y.Text` document.
- Editor canonical parses Markdown into a ProseMirror document and serializes it back with `prosemirror-markdown`.

## agent-plan.md

### Summary

| Model | Exact round-trip | Preserved features | Lost features |
| --- | --- | --- | --- |
| Markdown canonical | yes | frontmatter, taskLists | none |
| Editor canonical | no | none | frontmatter, taskLists |

### Original Markdown

````md
---
title: Agent Plan
owner: coding-agent
---

# Agent Plan

## Goals

- [ ] Build CLI publish
- [x] Verify E2EE spike
- [ ] Compare document models

## Notes

Agents should preserve Markdown as a portable artifact.


````

### Markdown-Canonical Export

````md
---
title: Agent Plan
owner: coding-agent
---

# Agent Plan

## Goals

- [ ] Build CLI publish
- [x] Verify E2EE spike
- [ ] Compare document models

## Notes

Agents should preserve Markdown as a portable artifact.


````

### Editor-Canonical Export

````md
---

## title: Agent Plan owner: coding-agent

# Agent Plan

## Goals

* \[ \] Build CLI publish
* \[x\] Verify E2EE spike
* \[ \] Compare document models

## Notes

Agents should preserve Markdown as a portable artifact.
````

## code-report.md

### Summary

| Model | Exact round-trip | Preserved features | Lost features |
| --- | --- | --- | --- |
| Markdown canonical | yes | tables, fencedCode, inlineCode | none |
| Editor canonical | no | fencedCode, inlineCode | tables |

### Original Markdown

````md
# Code Report

The agent changed `client.ts` and verified the protocol hardening.

```ts
export function example(value: string): string {
  return value.trim();
}
```

```bash
npm test
npm run typecheck
```

## Findings

| Area | Status | Notes |
| --- | --- | --- |
| Sync | Pass | WebSocket backlog replay works |
| Crypto | Pass | Metadata is authenticated |
| UI | Pending | Not started |


````

### Markdown-Canonical Export

````md
# Code Report

The agent changed `client.ts` and verified the protocol hardening.

```ts
export function example(value: string): string {
  return value.trim();
}
```

```bash
npm test
npm run typecheck
```

## Findings

| Area | Status | Notes |
| --- | --- | --- |
| Sync | Pass | WebSocket backlog replay works |
| Crypto | Pass | Metadata is authenticated |
| UI | Pending | Not started |


````

### Editor-Canonical Export

````md
# Code Report

The agent changed `client.ts` and verified the protocol hardening.

```ts
export function example(value: string): string {
  return value.trim();
}
```

```bash
npm test
npm run typecheck
```

## Findings

| Area | Status | Notes | | --- | --- | --- | | Sync | Pass | WebSocket backlog replay works | | Crypto | Pass | Metadata is authenticated | | UI | Pending | Not started |
````

## rich-agent-output.md

### Summary

| Model | Exact round-trip | Preserved features | Lost features |
| --- | --- | --- | --- |
| Markdown canonical | yes | fencedCode, mermaidFence, mathFence, inlineMath, links, images | none |
| Editor canonical | no | fencedCode, mermaidFence, mathFence, inlineMath, links, images | none |

### Original Markdown

````md
# Rich Agent Output

## Mermaid

```mermaid
flowchart LR
  Agent --> Markdown
  Markdown --> Room
```

## Math

Inline math: $E = mc^2$.

Block math:

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

## Links And Images

[Project repo](https://github.com/wanderingspirit03/agent-md-rooms)

![Diagram](./diagram.png)


````

### Markdown-Canonical Export

````md
# Rich Agent Output

## Mermaid

```mermaid
flowchart LR
  Agent --> Markdown
  Markdown --> Room
```

## Math

Inline math: $E = mc^2$.

Block math:

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

## Links And Images

[Project repo](https://github.com/wanderingspirit03/agent-md-rooms)

![Diagram](./diagram.png)


````

### Editor-Canonical Export

````md
# Rich Agent Output

## Mermaid

```mermaid
flowchart LR
  Agent --> Markdown
  Markdown --> Room
```

## Math

Inline math: $E = mc^2$.

Block math:

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

## Links And Images

[Project repo](https://github.com/wanderingspirit03/agent-md-rooms)

![Diagram](./diagram.png)
````

