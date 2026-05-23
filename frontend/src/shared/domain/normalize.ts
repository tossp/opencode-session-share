import type {
  MessageInfo,
  ModelInfo,
  RawPartData,
  RawShareItem,
  SessionDiffFile,
  SessionInfo,
} from './types';

const knownTopLevelTypes = new Set(['session', 'message', 'part', 'session_diff', 'model']);
const knownPartTypes = new Set([
  'text',
  'reasoning',
  'tool',
  'tool-call',
  'step-start',
  'step-finish',
  'patch',
  'compaction',
]);

export type NormalizationWarningCode =
  | 'unknown_top_level_type'
  | 'unknown_part_type'
  | 'malformed_item'
  | 'malformed_data';

export interface NormalizationWarning {
  code: NormalizationWarningCode;
  index: number;
  type?: string;
  path: string;
  message: string;
  item: unknown;
}

export interface IndexedRawShareItem {
  index: number;
  type?: string;
  item: unknown;
}

export interface RawItemIndex {
  all: IndexedRawShareItem[];
  byType: Record<string, IndexedRawShareItem[]>;
  unknownTopLevel: IndexedRawShareItem[];
  malformed: IndexedRawShareItem[];
}

export interface NormalizedShareData {
  session?: SessionInfo;
  messages: MessageInfo[];
  messagesBySessionID: Record<string, MessageInfo[]>;
  partsByMessageID: Record<string, RawPartData[]>;
  sessionDiffs: SessionDiffFile[];
  models: ModelInfo[];
  rawIndex: RawItemIndex;
  warnings: NormalizationWarning[];
}

interface MergeEntry<T extends Record<string, unknown>> {
  value: T;
  firstIndex: number;
}

export function normalizeShareItems(items: readonly RawShareItem[]): NormalizedShareData {
  const warnings: NormalizationWarning[] = [];
  const rawIndex = createRawIndex();
  const sessions = new Map<string, MergeEntry<Record<string, unknown>>>();
  const messages = new Map<string, MergeEntry<Record<string, unknown>>>();
  const parts = new Map<string, MergeEntry<Record<string, unknown>>>();
  const diffs = new Map<string, MergeEntry<Record<string, unknown>>>();
  const models = new Map<string, MergeEntry<Record<string, unknown>>>();

  items.forEach((rawItem, index) => {
    const item: unknown = rawItem;
    if (!isRecord(item) || typeof item.type !== 'string') {
      addRawIndex(rawIndex, index, undefined, item);
      addWarning(warnings, rawIndex, 'malformed_item', index, undefined, '', 'Item is not an object with a string type.', item);
      return;
    }

    const type = item.type;
    const indexed = addRawIndex(rawIndex, index, type, item);

    if (!knownTopLevelTypes.has(type)) {
      rawIndex.unknownTopLevel.push(indexed);
      addWarning(warnings, rawIndex, 'unknown_top_level_type', index, type, '', `Unknown top-level item type: ${type}.`, item);
      return;
    }

    switch (type) {
      case 'session':
        mergeObjectItem(sessions, item.data, index, type, warnings, rawIndex, sessionKey, 'data');
        break;
      case 'message':
        mergeObjectItem(messages, item.data, index, type, warnings, rawIndex, messageKey, 'data');
        break;
      case 'part':
        mergePartItem(parts, item.data, index, warnings, rawIndex);
        break;
      case 'session_diff':
        mergeArrayItem(diffs, item.data, index, type, warnings, rawIndex, diffKey, 'data');
        break;
      case 'model':
        mergeArrayItem(models, item.data, index, type, warnings, rawIndex, modelKey, 'data');
        break;
      default:
        break;
    }
  });

  const session = latestEntry([...sessions.values()])?.value as SessionInfo | undefined;
  const normalizedMessages = sortMessages([...messages.values()]).map((entry) => entry.value as MessageInfo);
  const normalizedParts = sortParts([...parts.values()]);

  return {
    session,
    messages: normalizedMessages,
    messagesBySessionID: groupMessages(normalizedMessages),
    partsByMessageID: groupParts(normalizedParts),
    sessionDiffs: [...diffs.values()].map((entry) => entry.value as SessionDiffFile),
    models: [...models.values()].map((entry) => entry.value as ModelInfo),
    rawIndex,
    warnings,
  };
}

function createRawIndex(): RawItemIndex {
  return {
    all: [],
    byType: {},
    unknownTopLevel: [],
    malformed: [],
  };
}

function addRawIndex(rawIndex: RawItemIndex, index: number, type: string | undefined, item: unknown): IndexedRawShareItem {
  const indexed = { index, type, item };
  rawIndex.all.push(indexed);

  if (type !== undefined) {
    rawIndex.byType[type] ??= [];
    rawIndex.byType[type].push(indexed);
  }

  return indexed;
}

function addWarning(
  warnings: NormalizationWarning[],
  rawIndex: RawItemIndex,
  code: NormalizationWarningCode,
  index: number,
  type: string | undefined,
  path: string,
  message: string,
  item: unknown,
): void {
  warnings.push({ code, index, type, path, message, item });

  if (code === 'malformed_item' || code === 'malformed_data') {
    rawIndex.malformed.push({ index, type, item });
  }
}

function mergeObjectItem(
  target: Map<string, MergeEntry<Record<string, unknown>>>,
  data: unknown,
  index: number,
  type: string,
  warnings: NormalizationWarning[],
  rawIndex: RawItemIndex,
  keyOf: (data: Record<string, unknown>, index: number) => string | undefined,
  path: string,
): void {
  if (!isRecord(data)) {
    addWarning(warnings, rawIndex, 'malformed_data', index, type, path, `${type} data must be an object.`, data);
    return;
  }

  const key = keyOf(data, index);
  if (key === undefined) {
    addWarning(warnings, rawIndex, 'malformed_data', index, type, path, `${type} data is missing required identity fields.`, data);
    return;
  }

  mergeEntry(target, key, data, index);
}

function mergePartItem(
  target: Map<string, MergeEntry<Record<string, unknown>>>,
  data: unknown,
  index: number,
  warnings: NormalizationWarning[],
  rawIndex: RawItemIndex,
): void {
  if (!isRecord(data)) {
    addWarning(warnings, rawIndex, 'malformed_data', index, 'part', 'data', 'part data must be an object.', data);
    return;
  }

  const partType = stringField(data, 'type');
  if (partType === undefined) {
    addWarning(warnings, rawIndex, 'malformed_data', index, 'part', 'data.type', 'part data is missing a string subtype.', data);
    return;
  }

  if (!knownPartTypes.has(partType)) {
    addWarning(warnings, rawIndex, 'unknown_part_type', index, 'part', 'data.type', `Unknown part subtype: ${partType}.`, data);
  }

  const key = partKey(data);
  if (key === undefined) {
    addWarning(warnings, rawIndex, 'malformed_data', index, 'part', 'data', 'part data is missing id or messageID.', data);
    return;
  }

  mergeEntry(target, key, data, index);
}

function mergeArrayItem(
  target: Map<string, MergeEntry<Record<string, unknown>>>,
  data: unknown,
  index: number,
  type: string,
  warnings: NormalizationWarning[],
  rawIndex: RawItemIndex,
  keyOf: (data: Record<string, unknown>, index: number) => string | undefined,
  path: string,
): void {
  if (!Array.isArray(data)) {
    addWarning(warnings, rawIndex, 'malformed_data', index, type, path, `${type} data must be an array.`, data);
    return;
  }

  data.forEach((entry, entryIndex) => {
    if (!isRecord(entry)) {
      addWarning(
        warnings,
        rawIndex,
        'malformed_data',
        index,
        type,
        `${path}.${entryIndex}`,
        `${type} array entry must be an object.`,
        entry,
      );
      return;
    }

    const key = keyOf(entry, entryIndex);
    if (key === undefined) {
      addWarning(
        warnings,
        rawIndex,
        'malformed_data',
        index,
        type,
        `${path}.${entryIndex}`,
        `${type} array entry is missing required identity fields.`,
        entry,
      );
      return;
    }

    mergeEntry(target, key, entry, index + entryIndex / 100_000);
  });
}

function mergeEntry(
  target: Map<string, MergeEntry<Record<string, unknown>>>,
  key: string,
  value: Record<string, unknown>,
  index: number,
): void {
  const existing = target.get(key);
  if (existing === undefined) {
    target.set(key, { value: cloneRecord(value), firstIndex: index });
    return;
  }

  const merged = mergeRicher(existing.value, value, true);
  target.set(key, { value: merged, firstIndex: existing.firstIndex });
}

function mergeRicher(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  preferRightOnTie: boolean,
): Record<string, unknown> {
  const comparison = compareRichness(left, right);
  const winner = comparison > 0 || (comparison === 0 && !preferRightOnTie) ? left : right;
  const loser = winner === left ? right : left;

  return deepMerge(loser, winner);
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (isRecord(existing) && isRecord(value)) {
      result[key] = deepMerge(existing, value);
      continue;
    }

    result[key] = cloneValue(value);
  }

  return result;
}

function compareRichness(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const checks = [
    Number(hasCompletedTime(left)) - Number(hasCompletedTime(right)),
    Number(hasNonEmptyStateOutput(left)) - Number(hasNonEmptyStateOutput(right)),
    (readNestedNumber(left, ['time', 'updated']) ?? 0) - (readNestedNumber(right, ['time', 'updated']) ?? 0),
    (readNestedNumber(left, ['time', 'end']) ?? 0) - (readNestedNumber(right, ['time', 'end']) ?? 0),
    meaningfulKeyCount(left) - meaningfulKeyCount(right),
  ];

  return checks.find((score) => score !== 0) ?? 0;
}

function hasCompletedTime(value: Record<string, unknown>): boolean {
  return readNestedNumber(value, ['time', 'completed']) !== undefined;
}

function hasNonEmptyStateOutput(value: Record<string, unknown>): boolean {
  const output = readNestedValue(value, ['state', 'output']);
  return typeof output === 'string' && output.trim().length > 0;
}

function meaningfulKeyCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + meaningfulKeyCount(item), 0);
  }

  if (!isRecord(value)) {
    return value === undefined || value === null || value === '' ? 0 : 1;
  }

  return Object.values(value).reduce<number>((total, item) => total + meaningfulKeyCount(item), 0);
}

function latestEntry<T extends Record<string, unknown>>(entries: MergeEntry<T>[]): MergeEntry<T> | undefined {
  return [...entries].sort((left, right) => compareEntries(right, left))[0];
}

function sortMessages(entries: MergeEntry<Record<string, unknown>>[]): MergeEntry<Record<string, unknown>>[] {
  return [...entries].sort((left, right) => {
    const leftCreated = readNestedNumber(left.value, ['time', 'created']);
    const rightCreated = readNestedNumber(right.value, ['time', 'created']);

    if (leftCreated !== rightCreated) {
      return (leftCreated ?? Number.POSITIVE_INFINITY) - (rightCreated ?? Number.POSITIVE_INFINITY);
    }

    return left.firstIndex - right.firstIndex;
  });
}

function sortParts(entries: MergeEntry<Record<string, unknown>>[]): MergeEntry<Record<string, unknown>>[] {
  return [...entries].sort((left, right) => {
    if (left.firstIndex !== right.firstIndex) {
      return left.firstIndex - right.firstIndex;
    }

    return partTime(left.value) - partTime(right.value);
  });
}

function compareEntries<T extends Record<string, unknown>>(left: MergeEntry<T>, right: MergeEntry<T>): number {
  const richness = compareRichness(left.value, right.value);
  if (richness !== 0) {
    return richness;
  }

  return right.firstIndex - left.firstIndex;
}

function groupMessages(messages: MessageInfo[]): Record<string, MessageInfo[]> {
  const grouped: Record<string, MessageInfo[]> = {};

  for (const message of messages) {
    const sessionID = message.sessionID ?? '';
    grouped[sessionID] ??= [];
    grouped[sessionID].push(message);
  }

  return grouped;
}

function groupParts(entries: MergeEntry<Record<string, unknown>>[]): Record<string, RawPartData[]> {
  const grouped: Record<string, RawPartData[]> = {};

  for (const entry of entries) {
    const messageID = stringField(entry.value, 'messageID') ?? '';
    grouped[messageID] ??= [];
    grouped[messageID].push(entry.value as RawPartData);
  }

  return grouped;
}

function sessionKey(data: Record<string, unknown>, index: number): string | undefined {
  return stringField(data, 'id') ?? `session:${index}`;
}

function messageKey(data: Record<string, unknown>): string | undefined {
  return stringField(data, 'id');
}

function partKey(data: Record<string, unknown>): string | undefined {
  const id = stringField(data, 'id');
  const messageID = stringField(data, 'messageID');

  if (id === undefined || messageID === undefined) {
    return undefined;
  }

  return `${messageID}/${id}`;
}

function diffKey(data: Record<string, unknown>, index: number): string | undefined {
  return stringField(data, 'file') ?? `session_diff:${index}`;
}

function modelKey(data: Record<string, unknown>, index: number): string | undefined {
  const id = stringField(data, 'id');
  const providerID = stringField(data, 'providerID');

  if (id !== undefined || providerID !== undefined) {
    return `${providerID ?? ''}/${id ?? ''}`;
  }

  return stringField(data, 'name') ?? `model:${index}`;
}

function partTime(data: Record<string, unknown>): number {
  return (
    readNestedNumber(data, ['time', 'created']) ??
    readNestedNumber(data, ['time', 'start']) ??
    readNestedNumber(data, ['time', 'end']) ??
    Number.POSITIVE_INFINITY
  );
}

function stringField(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNestedNumber(data: Record<string, unknown>, path: string[]): number | undefined {
  const value = readNestedValue(data, path);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNestedValue(data: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = data;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return cloneValue(value) as Record<string, unknown>;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = cloneValue(child);
    }
    return result;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
