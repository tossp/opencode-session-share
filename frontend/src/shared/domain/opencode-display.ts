import type {
  DisplayFileChange,
  DisplayMessage,
  DisplayMetric,
  DisplayOutlineItem,
  DisplayToolGroup,
  DisplayTurn,
  DisplayWarning,
  OpenCodeDisplayPlan,
} from './opencode-display-types';
import { buildRenderItems } from './opencode';
import type { OpenCodeDocument, RenderItem, SourceIndex, VisibleMessageEntry } from './opencode-types';
import type { MessageInfo, PatchPart, RawPartData, ToolCallPart, ToolPart } from './types';

export function buildOpenCodeDisplayPlan(document: OpenCodeDocument): OpenCodeDisplayPlan {
  const messages = document.visibleMessages.map((entry) => displayMessage(entry, document.renderItemsByMessageID[entry.message.id ?? '']));
  const timeline = buildTimeline(messages);

  return {
    overview: {
      title: document.summary.title,
      rootSessionID: document.rootSessionID,
      counts: metrics(document.summary.kindCounts),
      durationMs: document.summary.durationMs,
      totalCost: document.summary.totalCost,
      totalTokens: document.summary.totalTokens,
    },
    timeline,
    outline: buildOutline(timeline),
    toolGroups: buildToolGroups(messages),
    fileChanges: buildFileChanges(document),
    modelUsage: metrics(document.summary.modelCounts),
    warnings: buildWarnings(document),
    debugRawRefs: document.rawLog.entries.map((entry) => ({ rawItemIndex: entry.rawIndex })),
  };
}

function displayMessage(entry: VisibleMessageEntry, renderItems: RenderItem[] | undefined): DisplayMessage {
  return {
    id: entry.message.id ?? `message:${entry.messageIndex}`,
    role: entry.message.role ?? 'unknown',
    message: entry.message,
    parts: entry.parts,
    renderItems: renderItems ?? buildRenderItems(entry.parts, entry.partSourceIndexes),
    sourceIndexes: entry.sourceIndexes,
  };
}

function buildTimeline(messages: DisplayMessage[]): DisplayTurn[] {
  const turns: DisplayTurn[] = [];
  let current: DisplayTurn | undefined;
  messages.forEach((message, index) => {
    if (message.role === 'user' || current === undefined) {
      current = createTurn(message, turns.length, index);
      turns.push(current);
      return;
    }
    current.assistants.push(message);
    current.messages.push(message);
    current.rawRange = mergeRange(current.rawRange, rawRange(message.sourceIndexes));
    current.modelUsage = metrics(countModels(current.messages.map((entry) => entry.message)));
    current.toolCount += countTools(message.parts);
    current.fileCount = countFiles(current.messages);
  });
  return turns;
}

function createTurn(message: DisplayMessage, turnIndex: number, messageIndex: number): DisplayTurn {
  return {
    id: `display-turn-${message.id || messageIndex}`,
    title: titleForMessage(message.message, turnIndex),
    user: message.role === 'user' ? message : undefined,
    assistants: message.role === 'assistant' ? [message] : [],
    messages: [message],
    rawRange: rawRange(message.sourceIndexes),
    modelUsage: metrics(countModels([message.message])),
    toolCount: countTools(message.parts),
    fileCount: countFiles([message]),
  };
}

function buildOutline(turns: readonly DisplayTurn[]): DisplayOutlineItem[] {
  return turns.map((turn, index) => ({
    id: `outline-${turn.id}`,
    targetID: turn.id,
    label: `${index + 1}. ${turn.title}`,
    meta: `${turn.messages.length} messages · ${turn.toolCount} tools`,
    depth: 0,
    sourceIndexes: turn.messages.reduce<SourceIndex[]>((all, message) => all.concat(message.sourceIndexes), []),
  }));
}

function buildToolGroups(messages: readonly DisplayMessage[]): DisplayToolGroup[] {
  const groups: DisplayToolGroup[] = [];
  for (const message of messages) {
    message.renderItems.forEach((item, index) => {
      if (item.type !== 'tool-group') return;
      groups.push({
        id: `${message.id}:tool-group:${index}`,
        messageID: message.id,
        tools: item.parts.map((part) => part.tool ?? 'unknown'),
        statuses: item.parts.map((part) => part.state?.status ?? 'unknown'),
        sourceIndexes: item.sourceIndexes,
      });
    });
  }
  return groups;
}

function buildFileChanges(document: OpenCodeDocument): DisplayFileChange[] {
  const grouped = new Map<string, DisplayFileChange>();
  for (const diff of Object.values(document.latest.sessionDiffs)) {
    const file = diff.current.file;
    if (file === undefined) continue;
    const current = grouped.get(file) ?? { file, diffs: [], sourceIndexes: [] };
    current.diffs.push(diff.current);
    current.sourceIndexes.push(...diff.history.map((entry) => entry.sourceIndex));
    grouped.set(file, current);
  }
  return [...grouped.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function buildWarnings(document: OpenCodeDocument): DisplayWarning[] {
  const warnings = document.warnings.map((warning) => ({
    kind: warning.type ?? warning.code,
    message: warning.message,
    sourceIndexes: [{ rawItemIndex: warning.index }],
  }));
  const unknowns = document.rawLog.entries
    .filter((entry) => entry.kind === 'unknown_part' || entry.kind === 'unknown_top_level' || entry.kind === 'malformed')
    .map((entry) => ({ kind: entry.kind, message: entry.label, sourceIndexes: entry.sourceIndexes }));
  return warnings.concat(unknowns);
}

function titleForMessage(message: MessageInfo, index: number): string {
  const content = message.content?.trim();
  if (content !== undefined && content.length > 0) return content.length > 64 ? `${content.slice(0, 64)}…` : content;
  return `Turn ${index + 1}`;
}

function countModels(messages: readonly MessageInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const message of messages) {
    const label = modelLabel(message);
    if (label !== undefined) counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

function modelLabel(message: MessageInfo): string | undefined {
  const providerID = message.providerID ?? message.model?.providerID;
  const modelID = message.modelID ?? message.model?.modelID;
  if (providerID !== undefined && modelID !== undefined) return `${providerID}/${modelID}`;
  return modelID ?? providerID;
}

function countTools(parts: readonly RawPartData[]): number {
  return parts.filter(isToolPart).length;
}

function countFiles(messages: readonly DisplayMessage[]): number {
  const files = new Set<string>();
  for (const message of messages) for (const part of message.parts) if (isPatchPart(part)) for (const file of part.files ?? []) files.add(file);
  return files.size;
}

function rawRange(indexes: readonly SourceIndex[]): [number, number] {
  if (indexes.length === 0) return [-1, -1];
  const values = indexes.map((index) => index.rawItemIndex);
  return [Math.min(...values), Math.max(...values)];
}

function mergeRange(left: [number, number], right: [number, number]): [number, number] {
  if (left[0] < 0) return right;
  if (right[0] < 0) return left;
  return [Math.min(left[0], right[0]), Math.max(left[1], right[1])];
}

function metrics(counts: Record<string, number>): DisplayMetric[] {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({ label, value: String(value) }));
}

function isToolPart(part: RawPartData): part is ToolPart | ToolCallPart {
  return part.type === 'tool' || part.type === 'tool-call';
}

function isPatchPart(part: RawPartData): part is PatchPart {
  return part.type === 'patch';
}
