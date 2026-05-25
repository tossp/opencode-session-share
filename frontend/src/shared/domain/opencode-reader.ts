import { buildRenderItems } from './opencode';
import type { OpenCodeDocument, SourceIndex, VisibleMessageEntry } from './opencode-types';
import type {
  OpenCodeReaderPlan,
  ReaderInjectedMessage,
  ReaderInjectionDetection,
  ReaderInjectionKind,
  ReaderNarrativeItem,
  ReaderProvenance,
  ReaderSideEvent,
  ReaderToolRun,
} from './opencode-reader-types';
import type { MessageInfo, RawPartData } from './types';

const injectionMarkers: Array<{ kind: ReaderInjectionKind; marker: string }> = [
  { kind: 'system_reminder', marker: '<system-reminder' },
  { kind: 'omo_internal', marker: 'OMO_INTERNAL_INITIATOR' },
  { kind: 'background_task', marker: 'BACKGROUND TASK COMPLETED' },
  { kind: 'background_task', marker: 'ALL BACKGROUND TASKS COMPLETE' },
  { kind: 'continuation_prompt', marker: 'Continue if you have next steps' },
  { kind: 'task_result', marker: 'task_result' },
  { kind: 'compaction', marker: 'compaction_continue' },
];

export function buildOpenCodeReaderPlan(document: OpenCodeDocument): OpenCodeReaderPlan {
  const injectedIDs = new Set<string>();
  const sideEventIDs = new Set<string>();
  const mainNarrative: ReaderNarrativeItem[] = [];
  const injectedMessages: ReaderInjectedMessage[] = [];
  const sideEvents: ReaderSideEvent[] = [];

  for (const entry of document.visibleMessages) {
    const id = messageID(entry);
    const text = messageText(entry.message, entry.parts);
    const detection = detectInjectedMessage(entry.message, entry.parts);

    if (detection.isInjected) {
      injectedIDs.add(id);
      sideEventIDs.add(id);
      injectedMessages.push({ id, message: entry.message, parts: entry.parts, detection, sourceIndexes: entry.sourceIndexes, text });
      sideEvents.push(sideEvent(entry, 'injected_message', text));
      continue;
    }

    if (entry.message.parentID !== undefined && injectedIDs.has(entry.message.parentID)) {
      sideEventIDs.add(id);
      sideEvents.push(sideEvent(entry, 'assistant_after_injection', text));
      continue;
    }

    if (entry.message.role === 'user') {
      mainNarrative.push(narrativeItem(entry, 'real_user_input', text));
      sideEvents.push(...partSideEvents(entry));
      continue;
    }

    if (entry.message.role === 'assistant') {
      mainNarrative.push(narrativeItem(entry, 'assistant_response', text));
      sideEvents.push(...partSideEvents(entry));
      continue;
    }

    sideEventIDs.add(id);
    sideEvents.push(sideEvent(entry, 'non_dialog_message', text));
  }

  const toolRuns = document.tools.map((tool): ReaderToolRun => {
    const messageID = tool.messageID;
    const callID = tool.callID ?? tool.partID ?? `${tool.tool}:${tool.sourceIndexes.map((index) => index.rawItemIndex).join(',')}`;
    return {
      ...tool,
      narrativeMessageID: messageID !== undefined && !sideEventIDs.has(messageID) ? messageID : undefined,
      sideEventID: messageID !== undefined && sideEventIDs.has(messageID) ? messageID : undefined,
      sourceIndexes: tool.sourceIndexes,
      callID,
    };
  });

  return {
    mainNarrative,
    injectedMessages,
    sideEvents,
    toolRuns,
    provenance: buildProvenance(document, mainNarrative, sideEvents, toolRuns),
    rawDebug: {
      totalRawItems: document.rawLog.entries.length,
      hiddenFromMainCount: sideEvents.length,
      injectedUserMessageCount: injectedMessages.length,
      sideEventCount: sideEvents.length,
    },
  };
}

export function detectInjectedMessage(message: MessageInfo, parts: readonly RawPartData[]): ReaderInjectionDetection {
  if (message.role !== 'user') return { isInjected: false, kinds: [], markers: [] };

  const text = messageText(message, parts);
  const kinds: ReaderInjectionKind[] = [];
  const markers: string[] = [];
  for (const pattern of injectionMarkers) {
    if (!text.includes(pattern.marker)) continue;
    if (!kinds.includes(pattern.kind)) kinds.push(pattern.kind);
    markers.push(pattern.marker);
  }

  if (markers.length === 0 && looksLikeInternalSystemReminder(text)) {
    kinds.push('unknown_injection');
    markers.push('system-reminder');
  }

  return { isInjected: kinds.length > 0, kinds, markers };
}

function narrativeItem(entry: VisibleMessageEntry, kind: ReaderNarrativeItem['kind'], text: string): ReaderNarrativeItem {
  return {
    id: messageID(entry),
    kind,
    message: entry.message,
    parts: entry.parts,
    renderItems: buildRenderItems(entry.parts, entry.partSourceIndexes),
    sourceIndexes: entry.sourceIndexes,
    parentMessageID: entry.message.parentID,
    text,
  };
}

function sideEvent(entry: VisibleMessageEntry, kind: ReaderSideEvent['kind'], text: string): ReaderSideEvent {
  return { id: messageID(entry), kind, message: entry.message, parts: entry.parts, sourceIndexes: entry.sourceIndexes, parentMessageID: entry.message.parentID, messageID: entry.message.id, text };
}

function partSideEvents(entry: VisibleMessageEntry): ReaderSideEvent[] {
  const events: ReaderSideEvent[] = [];
  for (const part of entry.parts) {
    const kind = sidePartKind(part);
    if (kind === undefined) continue;
    events.push({
      id: `${messageID(entry)}:${part.id ?? part.type}`,
      kind,
      message: entry.message,
      part,
      sourceIndexes: entry.partSourceIndexes[partKey(part)] ?? [],
      parentMessageID: entry.message.parentID,
      messageID: entry.message.id,
      text: partText(part),
    });
  }
  return events;
}

function buildProvenance(
  document: OpenCodeDocument,
  narrative: readonly ReaderNarrativeItem[],
  sideEvents: readonly ReaderSideEvent[],
  toolRuns: readonly ReaderToolRun[],
): ReaderProvenance {
  const byMessageID: Record<string, SourceIndex[]> = {};
  for (const entry of document.visibleMessages) byMessageID[messageID(entry)] = entry.sourceIndexes;

  return {
    byMessageID,
    byNarrativeID: keyedSources(narrative),
    bySideEventID: keyedSources(sideEvents),
    byToolCallID: keyedToolSources(toolRuns),
  };
}

function messageID(entry: VisibleMessageEntry): string {
  return entry.message.id ?? `message:${entry.messageIndex}`;
}

function messageText(message: MessageInfo, parts: readonly RawPartData[]): string {
  const chunks: string[] = [];
  if (message.content !== undefined) chunks.push(message.content);
  for (const part of parts) {
    const text = partText(part);
    if (text.length > 0) chunks.push(text);
  }
  return chunks.join('\n');
}

function keyedSources(items: ReadonlyArray<{ id: string; sourceIndexes: SourceIndex[] }>): Record<string, SourceIndex[]> {
  const result: Record<string, SourceIndex[]> = {};
  for (const item of items) result[item.id] = item.sourceIndexes;
  return result;
}

function keyedToolSources(toolRuns: readonly ReaderToolRun[]): Record<string, SourceIndex[]> {
  const result: Record<string, SourceIndex[]> = {};
  for (const tool of toolRuns) result[tool.callID ?? tool.partID ?? tool.tool] = tool.sourceIndexes;
  return result;
}

function partText(part: RawPartData): string {
  return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
}

function sidePartKind(part: RawPartData): ReaderSideEvent['kind'] | undefined {
  if (part.type === 'reasoning') return 'reasoning_part';
  if (part.type === 'step-start') return 'step_start';
  if (part.type === 'step-finish') return 'step_finish';
  if (part.type === 'compaction') return 'compaction_part';
  return undefined;
}

function partKey(part: RawPartData): string {
  return part.id !== undefined && part.messageID !== undefined ? `${part.messageID}/${part.id}` : '';
}

function looksLikeInternalSystemReminder(text: string): boolean {
  return text.includes('<system-reminder') && (text.includes('background_output') || text.includes('system-reminder'));
}
