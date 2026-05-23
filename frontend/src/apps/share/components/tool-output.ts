export interface ToolStateLike {
  status?: string;
  title?: string;
  input?: string | Record<string, unknown>;
  output?: string;
  time?: {
    start?: number;
    end?: number;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolPartLike {
  tool?: string;
  callID?: string;
  state?: ToolStateLike;
}

export const longOutputLineLimit = 10;
export const longOutputCharLimit = 2000;

export interface ToolOutputSummary {
  full: string;
  preview: string;
  lineCount: number;
  charCount: number;
  isLong: boolean;
}

export interface AgentTaskSummary {
  kind: 'launch' | 'result' | 'status';
  taskID?: string;
  sessionID?: string;
  description?: string;
  agent?: string;
  status?: string;
}

export const isLongToolOutput = (output: string) =>
  output.split('\n').length > longOutputLineLimit || output.length > longOutputCharLimit;

export const summarizeToolOutput = (output: string): ToolOutputSummary => {
  const full = output.trim();
  const lines = full.length > 0 ? full.split('\n') : [];
  const isLong = isLongToolOutput(full);
  const preview = isLong ? lines.slice(0, 5).join('\n').slice(0, longOutputCharLimit) : full;

  return {
    full,
    preview,
    lineCount: lines.length,
    charCount: full.length,
    isLong,
  };
};

const valueFromRecord = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

export const toolDisplayName = (part: ToolPartLike, state: ToolStateLike = {}) =>
  part.tool?.trim() || valueFromRecord(state, 'toolType') || valueFromRecord(state, 'tool') || valueFromRecord(state, 'type') || 'unknown';

export const toolTitle = (state: ToolStateLike = {}) => {
  const directTitle = state.title?.trim() || valueFromRecord(state, 'name') || valueFromRecord(state, 'description');
  if (directTitle) {
    return directTitle;
  }

  if (state.metadata && typeof state.metadata === 'object') {
    const title = valueFromRecord(state.metadata, 'description');
    if (title) {
      return title;
    }
  }

  if (state.input && typeof state.input === 'object') {
    return valueFromRecord(state.input, 'description') || '';
  }

  return '';
};

export const formatToolInput = (input: ToolStateLike['input']) => {
  if (input === undefined) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  const command = valueFromRecord(input, 'command');
  if (command) {
    const description = valueFromRecord(input, 'description');
    return description ? `$ ${command}\n${description}` : `$ ${command}`;
  }

  return JSON.stringify(input, null, 2);
};

export const toolStatusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (['completed', 'success', 'done'].includes(normalized)) {
    return 'success' as const;
  }
  if (['error', 'failed', 'failure'].includes(normalized)) {
    return 'danger' as const;
  }
  if (['running', 'pending', 'started'].includes(normalized)) {
    return 'warning' as const;
  }
  return 'neutral' as const;
};

export const summarizeAgentTask = (part: ToolPartLike, output: string): AgentTaskSummary | undefined => {
  const tool = part.tool?.toLowerCase() ?? '';
  if (tool !== 'task' && tool !== 'background_output' && tool !== 'call_omo_agent') {
    return undefined;
  }

  const input = part.state?.input;
  const description = typeof input === 'object' && input !== null ? valueFromRecord(input, 'description') : undefined;
  const taskID = firstMatch(output, /Background Task ID:\s*([^\s]+)/) ?? firstMatch(output, /Task ID:\s*`?([^`\s]+)/);
  const sessionID = firstMatch(output, /session_id:\s*([^\s<]+)/) ?? firstMatch(output, /Session ID:\s*`?([^`\s]+)/);
  const agent = firstMatch(output, /Agent:\s*([^\n]+)/);
  const status = firstMatch(output, /Status:\s*([^\n]+)/)?.replace(/[*`]/g, '').trim();

  if (tool === 'task') {
    return { kind: 'launch', taskID, sessionID, description, agent, status };
  }

  return { kind: output.includes('Task Result') ? 'result' : 'status', taskID, sessionID, description, agent, status };
};

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1]?.trim();
}
