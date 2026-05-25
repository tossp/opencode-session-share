import { categorizeTool } from './categorize';
import { normalizeShareItems } from './normalize';
import type {
  ConvertOpenCodeOptions,
  ExtractedToolData,
  OpenCodeDocument,
  OpenCodeEntryKind,
  OpenCodeGraph,
  OpenCodeLatestState,
  OpenCodeMessageEnvelope,
  OpenCodeRawEntry,
  OpenCodeSummary,
  RenderItem,
  SourceIndex,
  VersionedValue,
  VisibleMessageEntry,
} from './opencode-types';
import type { MessageInfo, ModelInfo, RawPartData, RawShareItem, SessionDiffFile, SessionInfo, ToolCallPart, ToolPart } from './types';

const knownTopLevel = new Set(['session', 'message', 'part', 'session_diff', 'model']);
const knownPart = new Set([
  'text',
  'reasoning',
  'tool',
  'tool-call',
  'subtask',
  'file',
  'step-start',
  'step-finish',
  'snapshot',
  'patch',
  'agent',
  'retry',
  'compaction',
]);

export function convertOpenCodeShare(items: readonly RawShareItem[], options: ConvertOpenCodeOptions = {}): OpenCodeDocument {
  const normalized = normalizeShareItems(items);
  const rootSessionID = options.rootSessionID ?? normalized.session?.id ?? firstSessionID(items) ?? '';
  const rawLog = buildRawLog(items);
  const latest = buildLatestState(items, rootSessionID);
  const graph = buildGraph(rawLog.entries, latest);
  const visibleMessages = buildVisibleMessages(latest);
  const renderItemsByMessageID = buildRenderItemsByMessageID(visibleMessages);
  const tools = extractToolData(latest);
  const summary = buildSummary(rootSessionID, rawLog.entries, latest, tools, normalized.warnings);

  return {
    rootSessionID,
    rawLog,
    latest,
    graph,
    visibleMessages,
    renderItemsByMessageID,
    tools,
    summary,
    warnings: normalized.warnings,
  };
}

function buildRawLog(items: readonly RawShareItem[]): OpenCodeDocument['rawLog'] {
  const entries = items.map((item, rawIndex) => rawEntry(item, rawIndex));
  const byKind: Record<string, OpenCodeRawEntry[]> = {};
  for (const entry of entries) {
    byKind[entry.kind] ??= [];
    byKind[entry.kind].push(entry);
  }
  return { entries, byKind, sourceItems: items };
}

function rawEntry(item: RawShareItem | unknown, rawIndex: number): OpenCodeRawEntry {
  if (!isRecord(item) || typeof item.type !== 'string') {
    return baseEntry(rawIndex, 'malformed', item, item, 'Malformed item');
  }

  if (!knownTopLevel.has(item.type)) {
    return baseEntry(rawIndex, 'unknown_top_level', item, item.data, item.type);
  }

  if (item.type === 'part') {
    const data = item.data;
    if (!isRecord(data) || typeof data.type !== 'string') {
      return baseEntry(rawIndex, 'malformed', item, data, 'Malformed part');
    }
    const kind = knownPart.has(data.type) ? (data.type as OpenCodeEntryKind) : 'unknown_part';
    return baseEntry(rawIndex, kind, item, data, data.type, stringValue(data.sessionID), stringValue(data.messageID), stringValue(data.id));
  }

  const data = item.data;
  if (item.type === 'session' && isRecord(data)) {
    return baseEntry(rawIndex, 'session', item, data, item.type, stringValue(data.id), undefined, stringValue(data.id));
  }
  if (item.type === 'message' && isRecord(data)) {
    return baseEntry(rawIndex, 'message', item, data, item.type, stringValue(data.sessionID), stringValue(data.id), stringValue(data.id));
  }
  return baseEntry(rawIndex, item.type as OpenCodeEntryKind, item, data, item.type);
}

function baseEntry(
  rawIndex: number,
  kind: OpenCodeEntryKind,
  item: unknown,
  data: unknown,
  label: string,
  sessionID?: string,
  messageID?: string,
  itemID?: string,
): OpenCodeRawEntry {
  return { rawIndex, kind, item, data, sourceIndexes: [{ rawItemIndex: rawIndex }], sessionID, messageID, itemID, label };
}

function buildLatestState(items: readonly RawShareItem[], rootSessionID: string): OpenCodeLatestState {
  const sessions: Record<string, VersionedValue<SessionInfo>> = {};
  const messages: Record<string, VersionedValue<MessageInfo>> = {};
  const parts: Record<string, VersionedValue<RawPartData>> = {};
  const sessionDiffs: Record<string, VersionedValue<SessionDiffFile>> = {};
  const models: Record<string, VersionedValue<ModelInfo>> = {};

  items.forEach((item, rawItemIndex) => {
    if (!isRecord(item) || typeof item.type !== 'string') return;
    if (item.type === 'session' && isRecord(item.data)) upsertVersion(sessions, sessionKey(item.data, rawItemIndex), item.data as SessionInfo, { rawItemIndex });
    if (item.type === 'message' && isRecord(item.data)) {
      const key = stringValue(item.data.id) ?? `message:${rawItemIndex}`;
      upsertVersion(messages, key, item.data as MessageInfo, { rawItemIndex });
    }
    if (item.type === 'part' && isRecord(item.data)) {
      const key = partKey(item.data) ?? `part:${rawItemIndex}`;
      upsertVersion(parts, key, item.data as RawPartData, { rawItemIndex });
    }
    if (item.type === 'session_diff' && Array.isArray(item.data)) {
      item.data.forEach((diff, arrayOffset) => {
        if (isRecord(diff)) upsertVersion(sessionDiffs, diffKey(diff, arrayOffset), diff as SessionDiffFile, { rawItemIndex, arrayOffset });
      });
    }
    if (item.type === 'model' && Array.isArray(item.data)) {
      item.data.forEach((model, arrayOffset) => {
        if (isRecord(model)) upsertVersion(models, modelKey(model, arrayOffset), model as ModelInfo, { rawItemIndex, arrayOffset });
      });
    }
  });

  const messageEnvelopes = buildMessageEnvelopes(messages, parts);
  return { sessions, session: selectRootSession(sessions, rootSessionID), messages, parts, sessionDiffs, models, messageEnvelopes };
}

function upsertVersion<T extends object>(target: Record<string, VersionedValue<T>>, key: string, value: T, sourceIndex: SourceIndex): void {
  const existing = target[key];
  if (existing === undefined) {
    target[key] = { key, current: value, currentIndex: sourceIndex, history: [{ value, sourceIndex }] };
    return;
  }
  existing.history.push({ value, sourceIndex });
  existing.current = value;
  existing.currentIndex = sourceIndex;
}

function buildMessageEnvelopes(messages: Record<string, VersionedValue<MessageInfo>>, parts: Record<string, VersionedValue<RawPartData>>): OpenCodeMessageEnvelope[] {
  const partEntries = Object.values(parts).sort((left, right) => left.history[0].sourceIndex.rawItemIndex - right.history[0].sourceIndex.rawItemIndex);
  return Object.values(messages)
    .sort((left, right) => messageOrder(left) - messageOrder(right))
    .map((message) => {
      const messageID = message.current.id ?? '';
      const envelopeParts = partEntries.filter((part) => part.current.messageID === messageID);
      const partSourceIndexes: Record<string, SourceIndex[]> = {};
      for (const part of envelopeParts) partSourceIndexes[partKey(part.current) ?? part.key] = part.history.map((entry) => entry.sourceIndex);
      return {
        info: message.current,
        parts: envelopeParts.map((part) => part.current),
        sourceIndexes: message.history.map((entry) => entry.sourceIndex),
        partSourceIndexes,
      };
    });
}

function buildGraph(entries: OpenCodeRawEntry[], latest: OpenCodeLatestState): OpenCodeGraph {
  const nodes = entries.map((entry) => ({ id: nodeID(entry), rawIndex: entry.rawIndex, kind: entry.kind, sessionID: entry.sessionID, messageID: entry.messageID }));
  const edges: OpenCodeGraph['edges'] = [];
  const messagesBySessionID: Record<string, string[]> = {};
  const partsByMessageID: Record<string, string[]> = {};

  for (const message of Object.values(latest.messages)) {
    const sessionID = message.current.sessionID;
    if (sessionID !== undefined) {
      messagesBySessionID[sessionID] ??= [];
      messagesBySessionID[sessionID].push(message.current.id ?? message.key);
      edges.push({ from: `session:${sessionID}`, to: messageNodeID(message), type: 'session_message', sourceIndexes: message.history.map((entry) => entry.sourceIndex) });
    }
    if (message.current.parentID !== undefined) {
      edges.push({ from: `message:${message.current.parentID}`, to: messageNodeID(message), type: 'assistant_parent', sourceIndexes: message.history.map((entry) => entry.sourceIndex) });
    }
    addUpdateEdges(edges, 'message', message.key, message.history);
  }

  for (const part of Object.values(latest.parts)) {
    const messageID = part.current.messageID;
    if (messageID !== undefined) {
      partsByMessageID[messageID] ??= [];
      partsByMessageID[messageID].push(part.current.id ?? part.key);
      edges.push({ from: `message:${messageID}`, to: partNodeID(part), type: 'message_part', sourceIndexes: part.history.map((entry) => entry.sourceIndex) });
    }
    addUpdateEdges(edges, 'part', part.key, part.history);
  }

  for (const session of Object.values(latest.sessions)) {
    const parentID = stringValue((session.current as { parentID?: unknown }).parentID);
    if (parentID !== undefined) edges.push({ from: `session:${parentID}`, to: `session:${session.current.id ?? session.key}`, type: 'session_parent', sourceIndexes: session.history.map((entry) => entry.sourceIndex) });
    addUpdateEdges(edges, 'session', session.key, session.history);
  }

  return { nodes, edges, messagesBySessionID, partsByMessageID };
}

function buildVisibleMessages(latest: OpenCodeLatestState): VisibleMessageEntry[] {
  return latest.messageEnvelopes.map((message, messageIndex) => ({
    message: message.info,
    parts: message.parts,
    sourceIndexes: message.sourceIndexes,
    messageSourceIndex: message.sourceIndexes[message.sourceIndexes.length - 1] ?? { rawItemIndex: -1 },
    partSourceIndexes: message.partSourceIndexes,
    messageIndex,
    categorizedTools: message.parts.filter(isToolPart).map((part) => categorizeTool(part)),
  }));
}

function buildRenderItemsByMessageID(messages: VisibleMessageEntry[]): Record<string, RenderItem[]> {
  const result: Record<string, RenderItem[]> = {};
  for (const message of messages) result[message.message.id ?? ''] = buildRenderItems(message.parts, message.partSourceIndexes);
  return result;
}

export function buildRenderItems(parts: readonly RawPartData[], sourceIndexes: Record<string, SourceIndex[]> = {}): RenderItem[] {
  const items: RenderItem[] = [];
  let tools: Array<ToolPart | ToolCallPart> = [];
  let toolSources: SourceIndex[] = [];
  const flushTools = (): void => {
    if (tools.length === 0) return;
    items.push({ type: 'tool-group', parts: tools, sourceIndexes: toolSources });
    tools = [];
    toolSources = [];
  };
  for (const part of parts) {
    const sources = sourceIndexes[partKey(part) ?? ''] ?? [];
    if (isToolPart(part)) {
      tools.push(part);
      toolSources.push(...sources);
      continue;
    }
    flushTools();
    items.push({ type: 'single', part, sourceIndexes: sources });
  }
  flushTools();
  return items;
}

function extractToolData(latest: OpenCodeLatestState): ExtractedToolData[] {
  return Object.values(latest.parts)
    .filter((part): part is VersionedValue<ToolPart | ToolCallPart> => isToolPart(part.current))
    .map((part) => {
      const categorized = categorizeTool(part.current);
      return {
        tool: categorized.tool,
        callID: part.current.callID,
        rawInput: part.current.state?.input,
        rawOutput: typeof part.current.state?.output === 'string' ? part.current.state.output : undefined,
        rawError: part.current.state?.error,
        status: part.current.state?.status,
        title: part.current.state?.title,
        category: categorized.category,
        time: part.current.state?.time,
        state: part.current.state,
        sourceIndexes: part.history.map((entry) => entry.sourceIndex),
        messageID: part.current.messageID,
        partID: part.current.id,
      };
    });
}

function buildSummary(
  rootSessionID: string,
  entries: OpenCodeRawEntry[],
  latest: OpenCodeLatestState,
  tools: ExtractedToolData[],
  warnings: OpenCodeSummary['warnings'],
): OpenCodeSummary {
  return {
    rootSessionID,
    title: latest.session?.current.title ?? latest.session?.current.id ?? rootSessionID,
    totalEntries: entries.length,
    kindCounts: count(entries.map((entry) => entry.kind)),
    modelCounts: count(Object.values(latest.messages).map((message) => modelLabel(message.current)).filter(isString)),
    toolCounts: count(tools.map((tool) => tool.tool || 'unknown')),
    filesChanged: unique(fileNames(latest)),
    totalTokens: tokenTotal(latest),
    totalCost: costTotal(latest),
    durationMs: duration(latest.session?.current),
    warnings,
  };
}

function firstSessionID(items: readonly RawShareItem[]): string | undefined {
  for (const item of items) if (item.type === 'session' && isRecord(item.data)) return stringValue(item.data.id);
  return undefined;
}

function selectRootSession(sessions: Record<string, VersionedValue<SessionInfo>>, rootSessionID: string): VersionedValue<SessionInfo> | undefined {
  return sessions[rootSessionID] ?? Object.values(sessions)[0];
}

function sessionKey(data: Record<string, unknown>, index: number): string {
  return stringValue(data.id) ?? `session:${index}`;
}

function partKey(data: { id?: unknown; messageID?: unknown }): string | undefined {
  const id = stringValue(data.id);
  const messageID = stringValue(data.messageID);
  return id !== undefined && messageID !== undefined ? `${messageID}/${id}` : undefined;
}

function diffKey(data: Record<string, unknown>, index: number): string {
  return stringValue(data.file) ?? `session_diff:${index}`;
}

function modelKey(data: Record<string, unknown>, index: number): string {
  const providerID = stringValue(data.providerID);
  const id = stringValue(data.id ?? data.name);
  return providerID !== undefined && id !== undefined ? `${providerID}/${id}` : `model:${index}`;
}

function messageOrder(message: VersionedValue<MessageInfo>): number {
  return message.current.time?.created ?? message.history[0].sourceIndex.rawItemIndex;
}

function nodeID(entry: OpenCodeRawEntry): string {
  if (entry.kind === 'session' && entry.sessionID !== undefined) return `session:${entry.sessionID}`;
  if (entry.kind === 'message' && entry.messageID !== undefined) return `message:${entry.messageID}`;
  if (entry.messageID !== undefined && entry.itemID !== undefined) return `part:${entry.messageID}/${entry.itemID}`;
  return `${entry.kind}:${entry.itemID ?? entry.messageID ?? entry.sessionID ?? entry.rawIndex}`;
}

function messageNodeID(message: VersionedValue<MessageInfo>): string {
  return `message:${message.current.id ?? message.key}`;
}

function partNodeID(part: VersionedValue<RawPartData>): string {
  return `part:${partKey(part.current) ?? part.key}`;
}

function addUpdateEdges<T>(
  edges: OpenCodeGraph['edges'],
  prefix: string,
  key: string,
  history: Array<{ value: T; sourceIndex: SourceIndex }>,
): void {
  for (let index = 1; index < history.length; index += 1) {
    edges.push({
      from: `${prefix}:${key}@${history[index - 1].sourceIndex.rawItemIndex}`,
      to: `${prefix}:${key}@${history[index].sourceIndex.rawItemIndex}`,
      type: 'same_identity_update',
      sourceIndexes: [history[index - 1].sourceIndex, history[index].sourceIndex],
    });
  }
}

function modelLabel(message: MessageInfo): string | undefined {
  const providerID = message.providerID ?? message.model?.providerID;
  const modelID = message.modelID ?? message.model?.modelID;
  if (providerID !== undefined && modelID !== undefined) return `${providerID}/${modelID}`;
  return modelID ?? providerID;
}

function fileNames(latest: OpenCodeLatestState): string[] {
  const files: string[] = [];
  for (const diff of Object.values(latest.sessionDiffs)) if (diff.current.file !== undefined) files.push(diff.current.file);
  for (const message of Object.values(latest.messages)) for (const diff of message.current.summary?.diffs ?? []) if (diff.file !== undefined) files.push(diff.file);
  return files;
}

function tokenTotal(latest: OpenCodeLatestState): number | undefined {
  const sessionTokens = latest.session?.current.tokens;
  if (sessionTokens !== undefined) return tokenValue(sessionTokens);
  const total = sum(Object.values(latest.messages).map((message) => tokenValue(message.current.tokens)));
  return total > 0 ? total : undefined;
}

function costTotal(latest: OpenCodeLatestState): number | undefined {
  if (latest.session?.current.cost !== undefined) return latest.session.current.cost;
  const costs = Object.values(latest.messages).map((message) => message.current.cost).filter(isNumber);
  return costs.length > 0 ? sum(costs) : undefined;
}

function tokenValue(tokens: MessageInfo['tokens']): number | undefined {
  if (tokens === undefined) return undefined;
  return tokens.total ?? sum([tokens.input, tokens.output, tokens.reasoning, tokens.cache?.read, tokens.cache?.write]);
}

function duration(session: SessionInfo | undefined): number | undefined {
  const start = session?.time?.created;
  const end = session?.time?.updated;
  return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
}

function count(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function isToolPart(part: RawPartData): part is ToolPart | ToolCallPart {
  return part.type === 'tool' || part.type === 'tool-call';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}
