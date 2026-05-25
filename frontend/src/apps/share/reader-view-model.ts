import type { OpenCodeDocument, RenderItem, SourceIndex } from '../../shared/domain/opencode-types';
import type {
  OpenCodeReaderPlan,
  ReaderInjectedMessage,
  ReaderNarrativeItem,
  ReaderProvenance,
  ReaderRawDebug,
  ReaderSideEvent,
  ReaderToolRun,
} from '../../shared/domain/opencode-reader-types';
import type { MessageInfo, PatchPart, RawPartData, SessionDiffFile } from '../../shared/domain/types';

export interface ReaderViewModel {
  mainNarrative: ReaderNarrativeViewItem[];
  sections: ReaderTurnSection[];
  navSections: ReaderNavSection[];
  sideItems: ReaderSideItem[];
  debugItems: ReaderDebugItem[];
  toolRuns: ReaderToolRun[];
  fileSummaries: ReaderFileSummary[];
  meta: ReaderMetaSummary;
  provenance: ReaderProvenance;
  rawDebug: ReaderRawDebug;
}

export type ReaderRenderItem =
  | (Extract<RenderItem, { type: 'single' }> & { patch?: string })
  | Extract<RenderItem, { type: 'tool-group' }>;

export interface ReaderNarrativeViewItem {
  id: string;
  kind: ReaderNarrativeItem['kind'];
  message: MessageInfo;
  parts: RawPartData[];
  renderItems: ReaderRenderItem[];
  patchItems: ReaderPatchRenderData[];
  sourceIndexes: SourceIndex[];
  parentMessageID?: string;
  text: string;
}

export interface ReaderTurnSection {
  id: string;
  title: string;
  user?: ReaderNarrativeViewItem;
  assistants: ReaderNarrativeViewItem[];
  items: ReaderNarrativeViewItem[];
  sourceIndexes: SourceIndex[];
}

export interface ReaderNavSection {
  id: string;
  label: string;
  meta: string;
  tone: ReaderNarrativeItem['kind'];
}

export interface ReaderSideItem {
  id: string;
  kind: ReaderSideEvent['kind'];
  text: string;
  message?: MessageInfo;
  part?: RawPartData;
  parts?: RawPartData[];
  sourceIndexes: SourceIndex[];
  parentMessageID?: string;
  messageID?: string;
}

export interface ReaderDebugItem {
  id: string;
  label: string;
  value: ReaderInjectedMessage | ReaderSideEvent | ReaderToolRun;
  sourceIndexes: SourceIndex[];
}

export type ReaderPatchSource = 'message_summary' | 'session_diff' | 'empty';
export type ReaderPatchState = 'resolved' | 'empty';

export interface ReaderPatchRenderData {
  id: string;
  partID?: string;
  messageID?: string;
  file: string;
  files: string[];
  patch: string;
  source: ReaderPatchSource;
  state: ReaderPatchState;
  part: PatchPart;
  sourceIndexes: SourceIndex[];
}

export interface ReaderFileSummary {
  file: string;
  patch: string;
  status?: string;
  additions?: number;
  deletions?: number;
  sourceIndexes: SourceIndex[];
}

export interface ReaderMetaSummary {
  title: string;
  rootSessionID: string;
  totalRawItems: number;
  narrativeCount: number;
  sectionCount: number;
  sideItemCount: number;
  toolRunCount: number;
  fileCount: number;
}

export function createReaderViewModel(document: OpenCodeDocument, reader: OpenCodeReaderPlan): ReaderViewModel {
  const mainNarrative = reader.mainNarrative.map((item) => narrativeViewItem(item, document));
  const sections = buildReaderTurnSections(mainNarrative);

  return {
    mainNarrative,
    sections,
    navSections: buildReaderNavSections(sections),
    sideItems: buildSideItems(reader),
    debugItems: buildDebugItems(reader),
    toolRuns: reader.toolRuns,
    fileSummaries: buildFileSummaries(document),
    meta: buildMetaSummary(document, reader, sections),
    provenance: reader.provenance,
    rawDebug: reader.rawDebug,
  };
}

export function readerSectionID(value: string): string {
  return `turn-${slugify(value)}`;
}

export function buildReaderTurnSections(items: readonly ReaderNarrativeViewItem[]): ReaderTurnSection[] {
  const sections: ReaderTurnSection[] = [];
  let current: ReaderTurnSection | undefined;

  items.forEach((item, index) => {
    if (item.kind === 'real_user_input') {
      current = createSection(item, index);
      sections.push(current);
      return;
    }

    if (current === undefined) {
      current = createAssistantOnlySection(item, index);
      sections.push(current);
      return;
    }

    current.assistants.push(item);
    current.items.push(item);
    current.sourceIndexes = mergeSources(current.sourceIndexes, item.sourceIndexes);
  });

  return sections;
}

export function buildReaderNavSections(sections: readonly ReaderTurnSection[]): ReaderNavSection[] {
  return sections.map((section, index) => ({
    id: section.id,
    label: `${index + 1}. ${section.title}`,
    meta: sectionMeta(section),
    tone: section.user?.kind ?? 'assistant_response',
  }));
}

function narrativeViewItem(item: ReaderNarrativeItem, document: OpenCodeDocument): ReaderNarrativeViewItem {
  const patchItems = patchItemsForNarrative(item, document);

  return {
    id: item.id,
    kind: item.kind,
    message: item.message,
    parts: item.parts,
    renderItems: readerRenderItems(item.renderItems, patchItems),
    patchItems,
    sourceIndexes: item.sourceIndexes,
    parentMessageID: item.parentMessageID,
    text: item.text,
  };
}

function readerRenderItems(renderItems: readonly RenderItem[], patchItems: readonly ReaderPatchRenderData[]): ReaderRenderItem[] {
  return renderItems.map((renderItem) => {
    if (renderItem.type !== 'single' || !isPatchPart(renderItem.part)) return renderItem;

    return {
      ...renderItem,
      patch: patchForRenderItem(renderItem.part, patchItems),
    };
  });
}

function patchForRenderItem(part: PatchPart, patchItems: readonly ReaderPatchRenderData[]): string {
  const matches = patchItems.filter((patchItem) => patchItem.partID === part.id && patchItem.part === part);
  return matches.map((patchItem) => patchItem.patch).filter((patch) => patch.length > 0).join('\n\n');
}

function patchItemsForNarrative(item: ReaderNarrativeItem, document: OpenCodeDocument): ReaderPatchRenderData[] {
  const patches: ReaderPatchRenderData[] = [];
  for (const renderItem of item.renderItems) {
    if (renderItem.type !== 'single' || !isPatchPart(renderItem.part)) continue;
    patches.push(...patchDataForPart(renderItem.part, item.message, document, renderItem.sourceIndexes));
  }
  return patches;
}

function patchDataForPart(part: PatchPart, message: MessageInfo, document: OpenCodeDocument, sourceIndexes: SourceIndex[]): ReaderPatchRenderData[] {
  const files = part.files?.length ? part.files : [''];
  return files.map((file, index) => {
    const resolved = resolvePatch(file, message, document);
    return {
      id: `${message.id ?? 'message'}:${part.id ?? 'patch'}:${index}`,
      partID: part.id,
      messageID: message.id,
      file,
      files: part.files ?? [],
      patch: resolved.patch,
      source: resolved.source,
      state: resolved.patch.length > 0 ? 'resolved' : 'empty',
      part,
      sourceIndexes,
    };
  });
}

function resolvePatch(file: string, message: MessageInfo, document: OpenCodeDocument): { patch: string; source: ReaderPatchSource } {
  const summaryPatch = message.summary?.diffs?.find((diff) => diff.file === file)?.patch;
  if (summaryPatch !== undefined) return { patch: summaryPatch, source: 'message_summary' };

  const sessionPatch = Object.values(document.latest.sessionDiffs).find((diff) => diff.current.file === file)?.current.patch;
  if (sessionPatch !== undefined) return { patch: sessionPatch, source: 'session_diff' };

  return { patch: '', source: 'empty' };
}

function createSection(item: ReaderNarrativeViewItem, index: number): ReaderTurnSection {
  return {
    id: readerSectionID(item.id || `user:${index}`),
    title: titleForItem(item, index),
    user: item,
    assistants: [],
    items: [item],
    sourceIndexes: item.sourceIndexes,
  };
}

function createAssistantOnlySection(item: ReaderNarrativeViewItem, index: number): ReaderTurnSection {
  return {
    id: readerSectionID(item.id || `assistant:${index}`),
    title: titleForItem(item, index),
    assistants: [item],
    items: [item],
    sourceIndexes: item.sourceIndexes,
  };
}

function buildSideItems(reader: OpenCodeReaderPlan): ReaderSideItem[] {
  const injected = reader.injectedMessages.map((item): ReaderSideItem => ({
    id: item.id,
    kind: 'injected_message',
    text: item.text,
    message: item.message,
    parts: item.parts,
    sourceIndexes: item.sourceIndexes,
    messageID: item.message.id,
  }));
  const sideEvents = reader.sideEvents.map((event): ReaderSideItem => ({
    id: event.id,
    kind: event.kind,
    text: event.text,
    message: event.message,
    part: event.part,
    parts: event.parts,
    sourceIndexes: event.sourceIndexes,
    parentMessageID: event.parentMessageID,
    messageID: event.messageID,
  }));

  return injected.concat(sideEvents.filter((event) => !injected.some((item) => item.id === event.id)));
}

function buildDebugItems(reader: OpenCodeReaderPlan): ReaderDebugItem[] {
  return reader.injectedMessages
    .map((item): ReaderDebugItem => ({ id: `injected:${item.id}`, label: 'Injected message', value: item, sourceIndexes: item.sourceIndexes }))
    .concat(reader.sideEvents.map((event): ReaderDebugItem => ({ id: `side:${event.id}`, label: event.kind, value: event, sourceIndexes: event.sourceIndexes })))
    .concat(reader.toolRuns.map((tool): ReaderDebugItem => ({ id: `tool:${tool.callID ?? tool.partID ?? tool.tool}`, label: tool.tool, value: tool, sourceIndexes: tool.sourceIndexes })));
}

function buildFileSummaries(document: OpenCodeDocument): ReaderFileSummary[] {
  return Object.values(document.latest.sessionDiffs)
    .filter((diff): diff is typeof diff & { current: SessionDiffFile & { file: string } } => diff.current.file !== undefined)
    .map((diff) => ({
      file: diff.current.file,
      patch: diff.current.patch ?? '',
      status: diff.current.status,
      additions: diff.current.additions,
      deletions: diff.current.deletions,
      sourceIndexes: diff.history.map((entry) => entry.sourceIndex),
    }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

function buildMetaSummary(document: OpenCodeDocument, reader: OpenCodeReaderPlan, sections: readonly ReaderTurnSection[]): ReaderMetaSummary {
  return {
    title: document.summary.title,
    rootSessionID: document.rootSessionID,
    totalRawItems: document.rawLog.entries.length,
    narrativeCount: reader.mainNarrative.length,
    sectionCount: sections.length,
    sideItemCount: reader.sideEvents.length + reader.injectedMessages.length,
    toolRunCount: reader.toolRuns.length,
    fileCount: Object.values(document.latest.sessionDiffs).filter((diff) => diff.current.file !== undefined).length,
  };
}

function titleForItem(item: ReaderNarrativeViewItem, index: number): string {
  const text = item.text.trim() || item.message.content?.trim();
  if (text !== undefined && text.length > 0) return truncate(text, 64);
  if (item.kind === 'assistant_response') return 'Assistant response';
  return `第 ${index + 1} 轮对话`;
}

function sectionMeta(section: ReaderTurnSection): string {
  if (section.user === undefined) return `助手 × ${section.assistants.length}`;
  if (section.assistants.length === 0) return '用户';
  return `用户 → 助手 × ${section.assistants.length}`;
}

function mergeSources(left: readonly SourceIndex[], right: readonly SourceIndex[]): SourceIndex[] {
  return left.concat(right);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'section';
}

function isPatchPart(part: RawPartData): part is PatchPart {
  return part.type === 'patch';
}
