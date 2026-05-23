import { buildTurns } from '../../shared/domain/turns';
import type { ShareLoadState } from '../../shared/api/share';
import { normalizeShareItems, type NormalizedShareData } from '../../shared/domain/normalize';
import type {
  MessageInfo,
  PatchPart,
  RawPartData,
  RawShareItem,
  StepFinishPart,
  ToolCallPart,
  ToolPart,
} from '../../shared/domain/types';

export type DemoBlock =
  | { kind: 'markdown'; content: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'tool'; part: ToolPart | ToolCallPart }
  | { kind: 'patch'; files: string[]; patch: string }
  | { kind: 'finish'; part: StepFinishPart }
  | { kind: 'unknown'; part: Record<string, unknown> };

export interface DemoTurn {
  id: string;
  title: string;
  actor: string;
  time: string;
  category: string;
  summary: string;
  blocks: DemoBlock[];
}

export interface NavSection {
  id: string;
  label: string;
  meta: string;
  tone: string;
}

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
  navSections: NavSection[];
  normalized: NormalizedShareData;
  turns: DemoTurn[];
}

export type ShareAppViewState =
  | { status: 'idle' | 'loading'; title: string; message: string }
  | { status: 'password'; title: string; message: string; isRetry: boolean }
  | { status: 'error'; title: string; message: string }
  | { status: 'empty'; title: string; message: string }
  | { status: 'ready'; view: ShareViewModel };

export const demoTurns: DemoTurn[] = [
  {
    id: 'turn-kickoff',
    title: 'Share explorer shell',
    actor: 'User → Assistant',
    time: '09:12',
    category: 'planning',
    summary: 'Establish the session question, constraints, and initial rendering plan.',
    blocks: [
      {
        kind: 'markdown',
        content:
          '### Goal\nBuild a readable share explorer that keeps the conversation first, while navigation and metadata stay close at hand.',
      },
      {
        kind: 'reasoning',
        text: 'Prefer a stable timeline with local anchors so future normalized data can replace this demo payload without reshaping the view.',
      },
    ],
  },
  {
    id: 'turn-renderers',
    title: 'Renderer pass',
    actor: 'Assistant tools',
    time: '09:18',
    category: 'codebase-read',
    summary: 'Exercise text, reasoning, tool, patch, and completion blocks inside the real layout.',
    blocks: [
      {
        kind: 'tool',
        part: {
          type: 'tool',
          tool: 'read',
          callID: 'demo-read-components',
          state: {
            status: 'completed',
            title: 'Inspect renderer component exports',
            input: { filePath: 'frontend/src/apps/share/components/index.ts' },
            output: 'MarkdownBlock, ReasoningPart, ToolCallCard, StepFinishBlock, DiffViewer, PatchPart, UnknownPart, RawJsonDrawer',
            time: { start: 120, end: 163 },
          },
        },
      },
      {
        kind: 'patch',
        files: ['frontend/src/apps/share/ShareApp.svelte'],
        patch: '@@ -1,3 +1,4 @@\n <main class="share-shell">\n-  <section>Placeholder</section>\n+  <section id="turn-kickoff">Timeline</section>\n+  <nav aria-label="分节导航">Anchors</nav>',
      },
    ],
  },
  {
    id: 'turn-verification',
    title: 'Verification runway',
    actor: 'Assistant',
    time: '09:27',
    category: 'verification',
    summary: 'Keep acceptance criteria visible: anchors line up and the sidebar remains summary-only.',
    blocks: [
      {
        kind: 'markdown',
        content:
          'Checklist preview:\n\n- Anchor rail targets every timeline turn.\n- Meta sidebar avoids raw JSON dumps.\n- `pnpm --dir frontend check && pnpm --dir frontend build` stays green.',
      },
      {
        kind: 'finish',
        part: {
          type: 'step-finish',
          reason: 'demo-ready',
          cost: 0.004218,
          tokens: { input: 8120, output: 2048, reasoning: 512, total: 10680 },
        },
      },
    ],
  },
];

export const demoMeta: ShareMetaSummary = {
  title: 'OpenCode session share · layout preview',
  model: 'gpt-5.5 / aio',
  cost: '$0.004218',
  tokens: '10,680',
  duration: '15m 42s',
  counts: [
    { label: 'Turns', value: '3' },
    { label: 'Messages', value: '7' },
    { label: 'Blocks', value: '7' },
    { label: 'Artifacts', value: '2' },
  ],
  activity: ['Plan captured', 'Renderers exercised', 'Verification queued'],
  filesChanged: ['frontend/src/apps/share/ShareApp.svelte', 'frontend/src/apps/share/layout.ts'],
  toolCounts: [
    { label: 'Read', value: 3 },
    { label: 'Change', value: 2 },
    { label: 'Verification', value: 2 },
  ],
  errorCounts: [
    { label: 'Runtime', value: 0 },
    { label: 'Renderer fallback', value: 0 },
  ],
};

export function sectionID(turnID: string): string {
  return `turn-${slugify(turnID)}`;
}

export function buildNavSections(turns: readonly DemoTurn[]): NavSection[] {
  return turns.map((turn, index) => ({
    id: sectionID(turn.id),
    label: `${index + 1}. ${turn.title}`,
    meta: turn.category,
    tone: turn.category,
  }));
}

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
  const turns = buildTurns(normalized).map((turn, index) => toDemoTurn(turn, index, normalized));

  if (normalized.rawIndex.malformed.length > 0 || normalized.warnings.some((warning) => warning.code === 'malformed_data')) {
    return {
      status: 'error',
      title: '分享数据损坏',
      message: '这份分享包含无法识别的数据结构，暂时无法安全展示。',
    };
  }

  if (normalized.messages.length === 0 || turns.length === 0) {
    return {
      status: 'empty',
      title: '暂无可展示内容',
      message: '分享已创建，但当前没有可渲染的会话消息。',
    };
  }

  return {
    status: 'ready',
    view: {
      meta: buildMetaSummary(normalized, turns),
      navSections: buildNavSections(turns),
      normalized,
      turns,
    },
  };
}

function toDemoTurn(
  turn: ReturnType<typeof buildTurns>[number],
  index: number,
  normalized: NormalizedShareData,
): DemoTurn {
  const firstMessage = turn.messages[0]?.message;
  const lastMessage = turn.messages[turn.messages.length - 1]?.message ?? firstMessage;
  const assistantCount = turn.assistants.length;

  return {
    id: turn.id || `turn:${index}`,
    title: titleForMessage(firstMessage, index),
    actor: assistantCount > 0 ? `用户 → 助手 × ${assistantCount}` : '用户',
    time: formatTime(firstMessage?.time?.created),
    category: turn.categorizedTools[0]?.category ?? messageCategory(lastMessage),
    summary: summaryForTurn(turn, normalized),
    blocks: turn.messages.reduce<DemoBlock[]>((blocks, entry) => {
      blocks.push(...blocksForMessage(entry.message, entry.parts, normalized));
      return blocks;
    }, []),
  };
}

function blocksForMessage(message: MessageInfo, parts: readonly RawPartData[], normalized: NormalizedShareData): DemoBlock[] {
  const hasTextPart = parts.some((part) => part.type === 'text' && part.text?.trim());
  const contentBlock: DemoBlock[] = !hasTextPart && message.content?.trim()
    ? [{ kind: 'markdown' as const, content: message.content.trim() }]
    : [];

  for (const part of parts) {
    contentBlock.push(...blockForPart(part, message, normalized));
  }

  return contentBlock;
}

function blockForPart(part: RawPartData, message: MessageInfo, normalized: NormalizedShareData): DemoBlock[] {
  if (isTextPart(part)) {
    return part.text?.trim() ? [{ kind: 'markdown', content: part.text.trim() }] : [];
  }

  if (isReasoningPart(part)) {
    return part.text?.trim() ? [{ kind: 'reasoning', text: part.text.trim() }] : [];
  }

  if (isToolBlockPart(part)) {
    return [{ kind: 'tool', part }];
  }

  if (isPatchPart(part)) {
    return [{ kind: 'patch', files: part.files ?? [], patch: patchForPart(part, message, normalized) }];
  }

  if (isStepFinishPart(part)) {
    return [{ kind: 'finish', part }];
  }

  return [{ kind: 'unknown', part: { ...part } }];
}

function buildMetaSummary(normalized: NormalizedShareData, turns: readonly DemoTurn[]): ShareMetaSummary {
  const session = normalized.session;
  const totalTokens = session?.tokens?.total ?? sumNumbers(normalized.messages.map((message) => message.tokens?.total));
  const totalCost = session?.cost ?? sumNumbers(normalized.messages.map((message) => message.cost));
  const toolCounts = countLabels(toolLabels(turns));

  return {
    title: session?.title?.trim() || session?.id || 'OpenCode 会话分享',
    model: modelLabel(normalized),
    cost: formatCost(totalCost),
    tokens: formatNumber(totalTokens),
    duration: formatDuration(session?.time?.created, session?.time?.updated),
    counts: [
      { label: 'Turns', value: String(turns.length) },
      { label: 'Messages', value: String(normalized.messages.length) },
      { label: 'Blocks', value: String(turns.reduce((total, turn) => total + turn.blocks.length, 0)) },
      { label: 'Files', value: String(normalized.sessionDiffs.length) },
    ],
    activity: activitySummary(normalized, turns),
    filesChanged: normalized.sessionDiffs.map((file) => file.file).filter(isNonEmpty).slice(0, 12),
    toolCounts,
    errorCounts: warningCounts(normalized),
  };
}

function summaryForTurn(turn: ReturnType<typeof buildTurns>[number], normalized: NormalizedShareData): string {
  const tools = turn.categorizedTools.length;
  const changedFiles = new Set<string>();
  for (const entry of turn.messages) {
    for (const part of entry.parts) {
      if (isPatchPart(part)) {
        for (const file of part.files ?? []) {
          changedFiles.add(file);
        }
      }
    }
  }
  const files = changedFiles.size;
  const warningCount = normalized.warnings.length;

  return [`${turn.messages.length} 条消息`, tools > 0 ? `${tools} 次工具调用` : '', files > 0 ? `${files} 个文件变更` : '', warningCount > 0 ? `${warningCount} 条兼容警告` : '']
    .filter((value) => value.length > 0)
    .join(' · ');
}

function titleForMessage(message: MessageInfo | undefined, index: number): string {
  const content = message?.content?.trim();
  if (content) {
    return content.length > 48 ? `${content.slice(0, 48)}…` : content;
  }

  return `第 ${index + 1} 轮对话`;
}

function patchForPart(part: PatchPart, message: MessageInfo, normalized: NormalizedShareData): string {
  return (
    message.summary?.diffs?.find((diff) => part.files?.includes(diff.file ?? ''))?.patch ??
    normalized.sessionDiffs.find((diff) => part.files?.includes(diff.file ?? ''))?.patch ??
    ''
  );
}

function activitySummary(normalized: NormalizedShareData, turns: readonly DemoTurn[]): string[] {
  return [
    `已归一化 ${normalized.rawIndex.all.length} 条原始记录`,
    `构建 ${turns.length} 个会话轮次`,
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

function toolLabels(turns: readonly DemoTurn[]): string[] {
  const labels: string[] = [];
  for (const turn of turns) {
    for (const block of turn.blocks) {
      if (block.kind === 'tool') {
        labels.push(block.part.tool ?? 'unknown');
      }
    }
  }

  return labels;
}

function modelLabel(normalized: NormalizedShareData): string {
  const sessionModel = normalized.session?.model;
  if (sessionModel?.providerID || sessionModel?.id) {
    return [sessionModel.providerID, sessionModel.id].filter(isNonEmpty).join(' / ');
  }

  const model = normalized.models[0];
  return [model?.providerID, model?.name ?? model?.id].filter(isNonEmpty).join(' / ') || '未知模型';
}

function messageCategory(message: MessageInfo | undefined): string {
  return message?.role === 'user' ? 'user' : (message?.role ?? 'session');
}

function formatTime(value: number | undefined): string {
  if (value === undefined) {
    return '未知时间';
  }

  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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

function isTextPart(part: RawPartData): part is RawPartData & { type: 'text'; text?: string } {
  return part.type === 'text';
}

function isReasoningPart(part: RawPartData): part is RawPartData & { type: 'reasoning'; text?: string } {
  return part.type === 'reasoning';
}

function isToolBlockPart(part: RawPartData): part is ToolPart | ToolCallPart {
  return part.type === 'tool' || part.type === 'tool-call';
}

function isPatchPart(part: RawPartData): part is PatchPart {
  return part.type === 'patch';
}

function isStepFinishPart(part: RawPartData): part is StepFinishPart {
  return part.type === 'step-finish';
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'section';
}
