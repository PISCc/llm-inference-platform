---
name: knowledge-to-ppt
description: Convert an LLM answer, the current LLM inference platform page state, a technical comparison, or a link diagnosis into an editable PowerPoint deck. Use when the user asks to generate, export, download, outline, or revise a PPT/PPTX from platform knowledge, an assistant response, comparison results, or diagnosis evidence.
---

# Knowledge to PPT

Create an editable, source-aware technical deck from structured platform context. Keep model reasoning separate from deterministic rendering.

## Workflow

1. Collect exactly one source scope: current answer, current page, technical comparison, or link diagnosis.
2. Collect audience, duration, slide count, and theme. Default to technical colleagues, 10 minutes, 6 slides, and the platform light theme.
3. Produce a `PresentationSpec` that passes `schema.json`. Prefer the configured model for narrative structure; fall back to deterministic extraction when unavailable.
4. Show the outline before rendering. Allow slide titles, takeaways, and bullets to be edited.
5. Run `scripts/render-ppt.mjs <spec.json> <output.pptx> <qa-dir>` with the bundled presentation runtime.
6. Render every slide, inspect the montage and individual PNGs, and run the overflow check. Fix clipping, wrapping, overlap, missing sources, and mojibake before delivery.
7. Return only the final PPTX and a concise completion summary.

## Content Rules

- Preserve the source's uncertainty and boundaries. Never turn diagnosis candidates into confirmed root causes.
- Treat parameter-lab and comparison capacity calculations as formula results, not measured performance.
- Never invent latency, throughput, accuracy, hardware, version, or benchmark figures.
- Write audience-facing slide copy. Do not expose prompts, planning notes, generation modes, or implementation scaffolding.
- Add a `[Sources]` block to every slide's speaker notes.
- Use concise claims and no more than five bullets per slide.

Read `references/slide-rules.md` before changing layouts or copy limits. Use `schema.json` as the only accepted interchange contract. Do not manually edit the exported PPTX when a spec change can be rendered deterministically.
