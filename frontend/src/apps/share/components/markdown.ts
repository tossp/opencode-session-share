import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { Marked, type Tokens } from 'marked';

export interface CodeFenceBlock {
  id: string;
  code: string;
  language: string;
  highlightedHtml: string;
}

export interface RenderedMarkdown {
  html: string;
  codeBlocks: CodeFenceBlock[];
}

const fenceTokenPattern = /@@OC_CODE_BLOCK_(\d+)@@/g;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeLanguage = (language: string | undefined) => language?.trim().split(/\s+/)[0] ?? '';

const highlightCode = (code: string, language: string) => {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }

  return hljs.highlightAuto(code).value;
};

export const renderMarkdown = (markdown: string): RenderedMarkdown => {
  const codeBlocks: CodeFenceBlock[] = [];
  const marked = new Marked({
    gfm: true,
    breaks: true,
    async: false,
  });

  marked.use({
    renderer: {
      code(token: Tokens.Code) {
        const language = normalizeLanguage(token.lang);
        const id = `md-code-${codeBlocks.length}`;
        codeBlocks.push({
          id,
          code: token.text,
          language,
          highlightedHtml: highlightCode(token.text, language),
        });

        return `<div data-code-block-token="${codeBlocks.length - 1}"></div>`;
      },
    },
  });

  const rawHtml = marked.parse(markdown) as string;
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['data-code-block-token'],
  });

  return {
    html: sanitizedHtml.replace(/<div data-code-block-token="(\d+)"><\/div>/g, '@@OC_CODE_BLOCK_$1@@'),
    codeBlocks,
  };
};

export interface MarkdownSegmentHtml {
  kind: 'html';
  html: string;
}

export interface MarkdownSegmentCode {
  kind: 'code';
  block: CodeFenceBlock;
}

export type MarkdownSegment = MarkdownSegmentHtml | MarkdownSegmentCode;

export const splitMarkdownSegments = (rendered: RenderedMarkdown): MarkdownSegment[] => {
  const segments: MarkdownSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceTokenPattern.exec(rendered.html)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'html', html: rendered.html.slice(cursor, match.index) });
    }

    const block = rendered.codeBlocks[Number(match[1])];
    if (block) {
      segments.push({ kind: 'code', block });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < rendered.html.length) {
    segments.push({ kind: 'html', html: rendered.html.slice(cursor) });
  }

  return segments.filter((segment) => segment.kind === 'code' || segment.html.trim().length > 0);
};

export const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    return escapeHtml(String(value));
  }
};
