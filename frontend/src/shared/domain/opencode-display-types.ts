import type { OpenCodeEntryKind, RenderItem, SourceIndex } from './opencode-types';
import type { MessageInfo, RawPartData, SessionDiffFile } from './types';

export interface OpenCodeDisplayPlan {
  overview: DisplayOverview;
  timeline: DisplayTurn[];
  outline: DisplayOutlineItem[];
  toolGroups: DisplayToolGroup[];
  fileChanges: DisplayFileChange[];
  modelUsage: DisplayMetric[];
  warnings: DisplayWarning[];
  debugRawRefs: SourceIndex[];
}

export interface DisplayOverview {
  title: string;
  rootSessionID: string;
  counts: DisplayMetric[];
  durationMs?: number;
  totalCost?: number;
  totalTokens?: number;
}

export interface DisplayMetric {
  label: string;
  value: string;
}

export interface DisplayTurn {
  id: string;
  title: string;
  user?: DisplayMessage;
  assistants: DisplayMessage[];
  messages: DisplayMessage[];
  rawRange: [number, number];
  modelUsage: DisplayMetric[];
  toolCount: number;
  fileCount: number;
}

export interface DisplayMessage {
  id: string;
  role: string;
  message: MessageInfo;
  parts: RawPartData[];
  renderItems: RenderItem[];
  sourceIndexes: SourceIndex[];
}

export interface DisplayOutlineItem {
  id: string;
  targetID: string;
  label: string;
  meta: string;
  depth: number;
  sourceIndexes: SourceIndex[];
}

export interface DisplayToolGroup {
  id: string;
  messageID?: string;
  tools: string[];
  statuses: string[];
  sourceIndexes: SourceIndex[];
}

export interface DisplayFileChange {
  file: string;
  diffs: SessionDiffFile[];
  sourceIndexes: SourceIndex[];
}

export interface DisplayWarning {
  kind: OpenCodeEntryKind | string;
  message: string;
  sourceIndexes: SourceIndex[];
}
