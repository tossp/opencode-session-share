import { describe, expect, it } from 'vitest';
import { categorizeTool, type ToolCategory } from './categorize';
import type { ToolPart, ToolState } from './types';

function toolPart(tool: string | undefined, title = '', input: ToolState['input'] = ''): ToolPart {
  return {
    id: `part_${tool ?? 'missing'}`,
    type: 'tool',
    tool,
    state: { title, input },
  };
}

describe('categorizeTool', () => {
  it('categorizes representative non-command tools with deterministic name rules', () => {
    const cases: Array<[string | undefined, ToolCategory]> = [
      ['webfetch', 'external-research'],
      ['webSearch', 'external-research'],
      ['tavily_extract', 'external-research'],
      ['context7_query-docs', 'external-research'],
      ['ts_tool_blinko__webSearch', 'external-research'],
      ['read', 'codebase-read'],
      ['grep', 'codebase-read'],
      ['glob', 'codebase-read'],
      ['ast_grep_search', 'codebase-read'],
      ['lsp_diagnostics', 'codebase-read'],
      ['task', 'background-task'],
      ['background_output', 'background-task'],
      ['background_cancel', 'background-task'],
      ['todowrite', 'coordination'],
      ['skill', 'coordination'],
      ['question', 'coordination'],
      ['apply_patch', 'change'],
      ['write', 'change'],
      ['edit', 'change'],
      ['mystery_tool', 'unknown'],
      [undefined, 'unknown'],
    ];

    expect(cases.map(([tool]) => categorizeTool(toolPart(tool)).category)).toEqual(cases.map(([, category]) => category));
  });

  it('detects verification commands from bash title and input strings', () => {
    const commands = [
      toolPart('bash', 'Runs frontend test suite', 'pnpm --dir frontend test:run'),
      toolPart('bash', 'Builds app', 'pnpm build'),
      toolPart('bash', 'Checks types', 'pnpm --dir frontend check'),
      toolPart('bash', 'Run Go vet', 'go vet ./...'),
      toolPart('bash', 'Formats check', 'test -z "$(gofmt -l .)"'),
      toolPart('bash', 'Vulnerability scan', 'govulncheck ./...'),
      toolPart('bash', 'Runs npm tests', 'npm test'),
      toolPart('shell', '', { command: 'go test ./...' }),
      toolPart('bash', '', { command: 'pnpm test -- --run' }),
    ];

    expect(commands.map((part) => categorizeTool(part).category)).toEqual(
      commands.map(() => 'verification' satisfies ToolCategory),
    );
  });

  it('separates mutating shell commands from read-only shell commands', () => {
    expect(categorizeTool(toolPart('bash', 'Creates fixture file', 'mkdir frontend/tmp')).category).toBe('change');
    expect(categorizeTool(toolPart('bash', 'Lists current directory', 'ls frontend/src')).category).toBe('command');
  });

  it('returns the original part next to the category without mutation', () => {
    const part = toolPart('bash', 'Runs lint', 'pnpm lint');
    const before = JSON.stringify(part);
    const categorized = categorizeTool(part);

    expect(categorized).toMatchObject({ tool: 'bash', category: 'verification' });
    expect(categorized.part).toBe(part);
    expect(JSON.stringify(part)).toBe(before);
  });
});
