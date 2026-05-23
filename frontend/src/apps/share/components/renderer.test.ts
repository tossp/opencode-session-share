import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from './diff';
import { renderMarkdown, safeJson, splitMarkdownSegments } from './markdown';
import { isLongToolOutput, summarizeToolOutput } from './tool-output';

describe('markdown renderer helpers', () => {
  it('sanitizes dangerous html while preserving safe markdown', () => {
    const rendered = renderMarkdown('**safe**<script>window.evil = true</script><img src=x onerror="alert(1)">');

    expect(rendered.html).toContain('<strong>safe</strong>');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('window.evil');
    expect(rendered.html).not.toContain('onerror');
  });

  it('extracts fenced code blocks for CodeBlock rendering and highlights code', () => {
    const rendered = renderMarkdown('```ts\nconst answer: number = 42;\n```');
    const segments = splitMarkdownSegments(rendered);

    expect(rendered.codeBlocks).toHaveLength(1);
    expect(rendered.codeBlocks[0]?.language).toBe('ts');
    expect(rendered.codeBlocks[0]?.code).toContain('const answer');
    expect(rendered.codeBlocks[0]?.highlightedHtml).toContain('hljs-keyword');
    expect(segments.some((segment) => segment.kind === 'code')).toBe(true);
  });
});

describe('tool output renderer helpers', () => {
  it('keeps short output expanded by default', () => {
    expect(isLongToolOutput('one\ntwo\nthree')).toBe(false);
  });

  it('collapses output longer than ten lines', () => {
    const output = Array.from({ length: 11 }, (_, index) => `line ${index}`).join('\n');

    expect(isLongToolOutput(output)).toBe(true);
  });

  it('collapses output longer than 2000 characters', () => {
    expect(isLongToolOutput('x'.repeat(2001))).toBe(true);
  });

  it('summarizes long output while preserving full drawer content', () => {
    const output = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');
    const summary = summarizeToolOutput(output);

    expect(summary.isLong).toBe(true);
    expect(summary.lineCount).toBe(12);
    expect(summary.preview).toContain('line 5');
    expect(summary.preview).not.toContain('line 6');
    expect(summary.full).toBe(output);
  });
});

describe('diff renderer helpers', () => {
  it('parses unified patches with distinct add and remove lines', () => {
    const parsed = parseUnifiedDiff('@@ -1,2 +1,2 @@\n old\n-removed\n+added');

    expect(parsed.ok).toBe(true);
    expect(parsed.additions).toBe(1);
    expect(parsed.deletions).toBe(1);
    expect(parsed.lines.map((line) => line.kind)).toEqual(['hunk', 'context', 'remove', 'add']);
  });

  it('marks invalid patches for raw fallback rendering', () => {
    expect(parseUnifiedDiff('not a unified patch').ok).toBe(false);
  });
});

describe('unknown part renderer helpers', () => {
  it('formats arbitrary structured data for raw fallback rendering', () => {
    const raw = safeJson({ type: 'future-part', nested: { ok: true }, list: ['a', 1] });

    expect(raw).toContain('future-part');
    expect(raw).toContain('nested');
    expect(raw).toContain('ok');
  });
});
