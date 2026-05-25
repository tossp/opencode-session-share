import type { CategorizedTool, ToolCategory } from './categorize';
import type { NormalizationWarning } from './normalize';
import type {
  MessageInfo,
  ModelInfo,
  RawPartData,
  RawShareItem,
  RawTimestamp,
  SessionDiffFile,
  SessionInfo,
  ToolCallPart,
  ToolPart,
  ToolState,
} from './types';

export interface SourceIndex {
  rawItemIndex: number;
  arrayOffset?: number;
}

export type OpenCodeEntryKind =
  | 'session'
  | 'message'
  | 'text'
  | 'reasoning'
  | 'tool'
  | 'tool-call'
  | 'subtask'
  | 'file'
  | 'step-start'
  | 'step-finish'
  | 'snapshot'
  | 'patch'
  | 'agent'
  | 'retry'
  | 'compaction'
  | 'session_diff'
  | 'model'
  | 'unknown_top_level'
  | 'unknown_part'
  | 'malformed';

export interface OpenCodeRawEntry {
  rawIndex: number;
  kind: OpenCodeEntryKind;
  item: RawShareItem | unknown;
  data: unknown;
  sourceIndexes: SourceIndex[];
  sessionID?: string;
  messageID?: string;
  itemID?: string;
  label: string;
}

export interface VersionedValue<T> {
  key: string;
  current: T;
  currentIndex: SourceIndex;
  history: Array<{ value: T; sourceIndex: SourceIndex }>;
}

export interface OpenCodeMessageEnvelope {
  info: MessageInfo;
  parts: RawPartData[];
  sourceIndexes: SourceIndex[];
  partSourceIndexes: Record<string, SourceIndex[]>;
}

export interface OpenCodeLatestState {
  sessions: Record<string, VersionedValue<SessionInfo>>;
  session?: VersionedValue<SessionInfo>;
  messages: Record<string, VersionedValue<MessageInfo>>;
  parts: Record<string, VersionedValue<RawPartData>>;
  sessionDiffs: Record<string, VersionedValue<SessionDiffFile>>;
  models: Record<string, VersionedValue<ModelInfo>>;
  messageEnvelopes: OpenCodeMessageEnvelope[];
}

export interface OpenCodeGraphNode {
  id: string;
  rawIndex: number;
  kind: OpenCodeEntryKind;
  sessionID?: string;
  messageID?: string;
}

export type OpenCodeGraphEdgeType = 'session_message' | 'message_part' | 'assistant_parent' | 'session_parent' | 'same_identity_update';

export interface OpenCodeGraphEdge {
  from: string;
  to: string;
  type: OpenCodeGraphEdgeType;
  sourceIndexes: SourceIndex[];
}

export interface OpenCodeGraph {
  nodes: OpenCodeGraphNode[];
  edges: OpenCodeGraphEdge[];
  messagesBySessionID: Record<string, string[]>;
  partsByMessageID: Record<string, string[]>;
}

export interface VisibleMessageEntry {
  message: MessageInfo;
  parts: RawPartData[];
  sourceIndexes: SourceIndex[];
  messageSourceIndex: SourceIndex;
  partSourceIndexes: Record<string, SourceIndex[]>;
  messageIndex: number;
  categorizedTools: CategorizedTool[];
}

export type RenderItem =
  | { type: 'single'; part: RawPartData; sourceIndexes: SourceIndex[] }
  | { type: 'tool-group'; parts: Array<ToolPart | ToolCallPart>; sourceIndexes: SourceIndex[] };

export interface ExtractedToolData {
  tool: string;
  callID?: string;
  rawInput?: string | Record<string, unknown>;
  rawOutput?: string;
  rawError?: unknown;
  status?: string;
  title?: string;
  category: ToolCategory;
  time?: RawTimestamp;
  state?: ToolState;
  sourceIndexes: SourceIndex[];
  messageID?: string;
  partID?: string;
}

export interface OpenCodeSummary {
  rootSessionID: string;
  title: string;
  totalEntries: number;
  kindCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  toolCounts: Record<string, number>;
  filesChanged: string[];
  totalTokens?: number;
  totalCost?: number;
  durationMs?: number;
  warnings: NormalizationWarning[];
}

export interface OpenCodeDocument {
  rootSessionID: string;
  rawLog: {
    entries: OpenCodeRawEntry[];
    byKind: Record<string, OpenCodeRawEntry[]>;
    sourceItems: readonly RawShareItem[];
  };
  latest: OpenCodeLatestState;
  graph: OpenCodeGraph;
  visibleMessages: VisibleMessageEntry[];
  renderItemsByMessageID: Record<string, RenderItem[]>;
  tools: ExtractedToolData[];
  summary: OpenCodeSummary;
  warnings: NormalizationWarning[];
}

export interface ConvertOpenCodeOptions {
  rootSessionID?: string;
}

export type { MessageInfo, ModelInfo, RawPartData, RawShareItem, SessionDiffFile, SessionInfo };
