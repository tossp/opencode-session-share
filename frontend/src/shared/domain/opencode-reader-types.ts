import type { ExtractedToolData, RenderItem, SourceIndex } from './opencode-types';
import type { MessageInfo, RawPartData } from './types';

export interface OpenCodeReaderPlan {
  mainNarrative: ReaderNarrativeItem[];
  injectedMessages: ReaderInjectedMessage[];
  sideEvents: ReaderSideEvent[];
  toolRuns: ReaderToolRun[];
  provenance: ReaderProvenance;
  rawDebug: ReaderRawDebug;
}

export type ReaderNarrativeKind = 'real_user_input' | 'assistant_response';

export interface ReaderNarrativeItem {
  id: string;
  kind: ReaderNarrativeKind;
  message: MessageInfo;
  parts: RawPartData[];
  renderItems: RenderItem[];
  sourceIndexes: SourceIndex[];
  parentMessageID?: string;
  text: string;
}

export type ReaderInjectionKind = 'system_reminder' | 'omo_internal' | 'background_task' | 'continuation_prompt' | 'task_result' | 'compaction' | 'unknown_injection';

export interface ReaderInjectionDetection {
  isInjected: boolean;
  kinds: ReaderInjectionKind[];
  markers: string[];
}

export interface ReaderInjectedMessage {
  id: string;
  message: MessageInfo;
  parts: RawPartData[];
  detection: ReaderInjectionDetection;
  sourceIndexes: SourceIndex[];
  text: string;
}

export type ReaderSideEventKind = 'injected_message' | 'assistant_after_injection' | 'non_dialog_message' | 'reasoning_part' | 'step_start' | 'step_finish' | 'compaction_part';

export interface ReaderSideEvent {
  id: string;
  kind: ReaderSideEventKind;
  message?: MessageInfo;
  part?: RawPartData;
  parts?: RawPartData[];
  sourceIndexes: SourceIndex[];
  parentMessageID?: string;
  messageID?: string;
  text: string;
}

export interface ReaderToolRun extends ExtractedToolData {
  narrativeMessageID?: string;
  sideEventID?: string;
}

export interface ReaderProvenance {
  byMessageID: Record<string, SourceIndex[]>;
  byNarrativeID: Record<string, SourceIndex[]>;
  bySideEventID: Record<string, SourceIndex[]>;
  byToolCallID: Record<string, SourceIndex[]>;
}

export interface ReaderRawDebug {
  totalRawItems: number;
  hiddenFromMainCount: number;
  injectedUserMessageCount: number;
  sideEventCount: number;
}
