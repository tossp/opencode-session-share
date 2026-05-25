import type { ShareLoadState } from '../../shared/api/share';
import { normalizeShareItems, type NormalizedShareData } from '../../shared/domain/normalize';
import { convertOpenCodeShare } from '../../shared/domain/opencode';
import { buildOpenCodeReaderPlan } from '../../shared/domain/opencode-reader';
import type { OpenCodeDocument, OpenCodeRawEntry, SourceIndex } from '../../shared/domain/opencode-types';
import type { RawShareItem } from '../../shared/domain/types';
import { createReaderViewModel, type ReaderNavSection, type ReaderViewModel } from './reader-view-model';

export interface ShareMetaSummary {
  title: string;
  model: string;
  cost: string;
  tokens: string;
  duration: string;
  counts: Array<{ label: string; value: string }>;
  activity: string[];
  filesChanged: string[];
  toolCounts: Array<{ label: string; value: number }>;
  errorCounts: Array<{ label: string; value: number }>;
}

export interface ShareViewModel {
  meta: ShareMetaSummary;
  navSections: ReaderNavSection[];
  normalized: NormalizedShareData;
  reader: ReaderViewModel;
  rawSources: ShareRawSourceDebug;
}

export interface ShareRawSourceDebug {
  entries: readonly OpenCodeRawEntry[];
  sourceItems: readonly RawShareItem[];
}

export interface ResolvedRawSource {
  sourceIndex: SourceIndex;
  rawEntry?: OpenCodeRawEntry;
  sourceItem?: RawShareItem;
}

export type ShareAppViewState =
  | { status: 'idle' | 'loading'; title: string; message: string }
  | { status: 'password'; title: string; message: string; isRetry: boolean }
  | { status: 'error'; title: string; message: string }
  | { status: 'empty'; title: string; message: string }
  | { status: 'ready'; view: ShareViewModel };

export function resolveShareID(locationLike: Pick<Location, 'pathname'> = window.location): string {
  const globalID = window.SHARE_ID?.trim();
  if (globalID) {
    return globalID;
  }

  const segments = locationLike.pathname.split('/').filter((segment) => segment.length > 0);
  const shareIndex = segments.indexOf('share');
  const pathID = shareIndex >= 0 ? segments[shareIndex + 1] : segments[segments.length - 1];

  return pathID !== undefined ? decodeURIComponent(pathID) : '';
}

export function shareViewStateFromLoadState(state: ShareLoadState): ShareAppViewState {
  switch (state.status) {
    case 'ready':
      return createShareViewModel(state.items);
    case 'password':
      return { status: 'password', title: state.message, message: state.message, isRetry: state.isRetry };
    case 'error':
      return {
        status: 'error',
        title: state.kind === 'not_found' ? '分享不存在' : '加载分享数据失败',
        message: state.message,
      };
    case 'idle':
    case 'loading':
      return { status: 'loading', title: '正在加载分享', message: '正在从服务器读取会话数据…' };
  }
}

export function createShareViewModel(items: readonly RawShareItem[]): ShareAppViewState {
  const normalized = normalizeShareItems(items);
  const document = convertOpenCodeShare(items, { rootSessionID: normalized.session?.id });
  const reader = buildOpenCodeReaderPlan(document);
  const readerView = createReaderViewModel(document, reader);

  if (normalized.rawIndex.malformed.length > 0 || normalized.warnings.some((warning) => warning.code === 'malformed_data')) {
    return {
      status: 'error',
      title: '分享数据损坏',
      message: '这份分享包含无法识别的数据结构，暂时无法安全展示。',
    };
  }

  if (readerView.mainNarrative.length === 0 || readerView.sections.length === 0) {
    return {
      status: 'empty',
      title: '暂无可展示内容',
      message: '分享已创建，但当前没有可渲染的会话消息。',
    };
  }

  return {
    status: 'ready',
    view: {
      meta: buildMetaSummary(normalized, readerView),
      navSections: readerView.navSections,
      normalized,
      reader: readerView,
      rawSources: buildRawSourceDebug(document),
    },
  };
}

export function buildRawSourceDebug(document: OpenCodeDocument): ShareRawSourceDebug {
  return {
    entries: document.rawLog.entries,
    sourceItems: document.rawLog.sourceItems,
  };
}

export function resolveRawSources(debug: ShareRawSourceDebug, sourceIndexes: readonly SourceIndex[]): ResolvedRawSource[] {
  const entriesByRawIndex = new Map(debug.entries.map((entry) => [entry.rawIndex, entry]));

  return sourceIndexes.map((sourceIndex) => ({
    sourceIndex,
    rawEntry: entriesByRawIndex.get(sourceIndex.rawItemIndex),
    sourceItem: debug.sourceItems[sourceIndex.rawItemIndex],
  }));
}

function buildMetaSummary(normalized: NormalizedShareData, reader: ReaderViewModel): ShareMetaSummary {
  const session = normalized.session;
  const totalTokens = session?.tokens?.total ?? sumNumbers(normalized.messages.map((message) => message.tokens?.total));
  const totalCost = session?.cost ?? sumNumbers(normalized.messages.map((message) => message.cost));
  const toolCounts = countLabels(reader.toolRuns.map((tool) => tool.tool || 'unknown'));

  return {
    title: session?.title?.trim() || session?.id || 'OpenCode 会话分享',
    model: modelLabel(normalized),
    cost: formatCost(totalCost),
    tokens: formatNumber(totalTokens),
    duration: formatDuration(session?.time?.created, session?.time?.updated),
    counts: [
      { label: 'Sections', value: String(reader.sections.length) },
      { label: 'Messages', value: String(normalized.messages.length) },
      { label: 'Narrative', value: String(reader.mainNarrative.length) },
      { label: 'Side events', value: String(reader.sideItems.length) },
      { label: 'Tool runs', value: String(reader.toolRuns.length) },
      { label: 'Files', value: String(reader.fileSummaries.length) },
    ],
    activity: activitySummary(normalized, reader),
    filesChanged: reader.fileSummaries.map((file) => file.file).filter(isNonEmpty).slice(0, 12),
    toolCounts,
    errorCounts: warningCounts(normalized),
  };
}

function activitySummary(normalized: NormalizedShareData, reader: ReaderViewModel): string[] {
  return [
    `已归一化 ${normalized.rawIndex.all.length} 条原始记录`,
    `构建 ${reader.sections.length} 个 Reader 章节`,
    `主叙事 ${reader.mainNarrative.length} 条，侧边事件 ${reader.sideItems.length} 条`,
    normalized.warnings.length > 0 ? `保留 ${normalized.warnings.length} 条兼容警告` : '未发现兼容警告',
  ];
}

function warningCounts(normalized: NormalizedShareData): Array<{ label: string; value: number }> {
  const counts = countLabels(normalized.warnings.map((warning) => warning.code));
  return counts.length > 0 ? counts : [{ label: 'Warnings', value: 0 }];
}

function countLabels(labels: readonly string[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function modelLabel(normalized: NormalizedShareData): string {
  const sessionModel = normalized.session?.model;
  if (sessionModel?.providerID || sessionModel?.id) {
    return [sessionModel.providerID, sessionModel.id].filter(isNonEmpty).join(' / ');
  }

  const model = normalized.models[0];
  return [model?.providerID, model?.name ?? model?.id].filter(isNonEmpty).join(' / ') || '未知模型';
}

function formatDuration(start: number | undefined, end: number | undefined): string {
  if (start === undefined || end === undefined || end < start) {
    return '未知';
  }

  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatCost(value: number): string {
  return value > 0 ? `$${value.toFixed(6)}` : '$0';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}
