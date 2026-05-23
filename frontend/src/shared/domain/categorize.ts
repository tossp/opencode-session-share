import type { ToolCallPart, ToolPart, ToolState } from './types';

export type ToolCategory =
  | 'external-research'
  | 'codebase-read'
  | 'background-task'
  | 'command'
  | 'verification'
  | 'coordination'
  | 'change'
  | 'unknown';

export interface CategorizedTool<T extends ToolPart | ToolCallPart = ToolPart | ToolCallPart> {
  part: T;
  tool: string;
  category: ToolCategory;
}

const codebaseReadTools = new Set(['read', 'grep', 'glob', 'ast_grep_search']);
const backgroundTaskTools = new Set(['task', 'background_output', 'background_cancel', 'call_omo_agent']);
const coordinationTools = new Set(['todowrite', 'skill', 'question', 'questions']);
const changeTools = new Set(['apply_patch', 'edit', 'write', 'multi_edit']);

const verificationPattern =
  /\b(test|tests|test:run|build|check|lint|vet|gofmt|govulncheck|tsc|vitest|go\s+test|npm\s+test|pnpm\s+test|pnpm\s+--dir\s+\S+\s+test|pnpm\s+--dir\s+\S+\s+check)\b/i;
const mutationPattern = /\b(apply_patch|write|edit|create|delete|remove|mv|cp|mkdir|touch|chmod|chown|install|add|update|patch)\b/i;

export function categorizeTool<T extends ToolPart | ToolCallPart>(part: T): CategorizedTool<T> {
  const tool = part.tool ?? '';
  const normalizedTool = tool.toLowerCase();

  return {
    part,
    tool,
    category: categoryForTool(normalizedTool, part.state),
  };
}

function categoryForTool(tool: string, state: ToolState | undefined): ToolCategory {
  if (tool.length === 0) {
    return 'unknown';
  }

  if (tool === 'bash' || tool === 'shell') {
    return categorizeCommand(state);
  }

  if (isExternalResearchTool(tool)) {
    return 'external-research';
  }

  if (codebaseReadTools.has(tool) || tool.startsWith('lsp_')) {
    return 'codebase-read';
  }

  if (backgroundTaskTools.has(tool)) {
    return 'background-task';
  }

  if (coordinationTools.has(tool)) {
    return 'coordination';
  }

  if (changeTools.has(tool) || tool.includes('apply_patch') || tool.includes('write') || tool.includes('edit')) {
    return 'change';
  }

  return 'unknown';
}

function categorizeCommand(state: ToolState | undefined): ToolCategory {
  const text = stateText(state);

  if (verificationPattern.test(text)) {
    return 'verification';
  }

  if (mutationPattern.test(text)) {
    return 'change';
  }

  return 'command';
}

function isExternalResearchTool(tool: string): boolean {
  return (
    tool.includes('webfetch') ||
    tool.includes('websearch') ||
    tool.includes('web_search') ||
    tool.includes('tavily') ||
    tool.includes('context7') ||
    (tool.startsWith('ts_tool_') && tool.includes('web'))
  );
}

function stateText(state: ToolState | undefined): string {
  if (state === undefined) {
    return '';
  }

  return [state.title ?? '', stateInputText(state.input)].filter((value) => value.length > 0).join('\n');
}

function stateInputText(input: ToolState['input']): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input === undefined) {
    return '';
  }

  return Object.entries(input)
    .map(([key, value]) => `${key}:${stringValue(value)}`)
    .join('\n');
}

function stringValue(value: unknown | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}
