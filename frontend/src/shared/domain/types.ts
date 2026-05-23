// ---------------------------------------------------------------------------
// Raw share data types
//
// Modelled from the real API payload shape.  Every field that is not
// guaranteed by the contract is optional so that normalizers / renderers
// never assume the presence of a field that might be absent in older or
// trimmed payloads.
// ---------------------------------------------------------------------------

// ── Shared primitives ──────────────────────────────────────────────────────

export interface RawTimestamp {
  created?: number;
  updated?: number;
  start?: number;
  end?: number;
}

export interface RawTokenCounts {
  total?: number;
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

export interface RawCostInfo {
  input?: number;
  output?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

export interface RawSessionSummary {
  additions?: number;
  deletions?: number;
  files?: number;
}

export interface RawShareRef {
  url?: string;
}

// ── Part subtypes (discriminated on data.type) ─────────────────────────────

export interface BasePartFields {
  id?: string;
  sessionID?: string;
  messageID?: string;
  time?: RawTimestamp;
  metadata?: Record<string, unknown>;
}

export interface TextPart extends BasePartFields {
  type: "text";
  text?: string;
}

export interface ReasoningPart extends BasePartFields {
  type: "reasoning";
  text?: string;
}

export interface ToolPart extends BasePartFields {
  type: "tool";
  tool?: string;
  callID?: string;
  state?: ToolState;
}

/** Legacy alias – some older payloads emit "tool-call" instead of "tool". */
export interface ToolCallPart extends BasePartFields {
  type: "tool-call";
  tool?: string;
  callID?: string;
  state?: ToolState;
}

export interface StepStartPart extends BasePartFields {
  type: "step-start";
  snapshot?: string;
}

export interface StepFinishPart extends BasePartFields {
  type: "step-finish";
  snapshot?: string;
  reason?: string;
  tokens?: RawTokenCounts;
  cost?: number;
}

export interface PatchPart extends BasePartFields {
  type: "patch";
  files?: string[];
  hash?: string;
}

export interface CompactionPart extends BasePartFields {
  type: "compaction";
  auto?: boolean;
  tail_start_id?: string;
}

export interface UnknownPart extends BasePartFields {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export type RawPartData =
  | TextPart
  | ReasoningPart
  | ToolPart
  | ToolCallPart
  | StepStartPart
  | StepFinishPart
  | PatchPart
  | CompactionPart
  | UnknownPart;

// ── Tool state (used inside ToolPart / ToolCallPart) ───────────────────────

export interface ToolState {
  status?: string;
  title?: string;
  input?: string | Record<string, unknown>;
  output?: string;
  time?: RawTimestamp;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Session item data ──────────────────────────────────────────────────────

export interface SessionInfo {
  id?: string;
  slug?: string;
  projectID?: string;
  directory?: string;
  path?: string;
  title?: string;
  agent?: string;
  model?: {
    id?: string;
    providerID?: string;
    variant?: string;
  };
  version?: string;
  summary?: RawSessionSummary;
  cost?: number;
  tokens?: RawTokenCounts;
  share?: RawShareRef;
  time?: RawTimestamp;
}

/** Alias – SessionInfo and RawSessionData are identical. */
export type RawSessionData = SessionInfo;

// ── Message item data ──────────────────────────────────────────────────────

export interface MessageInfo {
  id?: string;
  sessionID?: string;
  role?: string;
  agent?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  variant?: string;
  finish?: string;
  parentID?: string;
  path?: string;
  content?: string;
  cost?: number;
  model?: {
    providerID?: string;
    modelID?: string;
    variant?: string;
  };
  summary?: {
    diffs?: Array<{
      file?: string;
      patch?: string;
    }>;
  };
  tokens?: RawTokenCounts;
  time?: RawTimestamp;
}

/** Alias – MessageInfo and RawMessageData are identical. */
export type RawMessageData = MessageInfo;


// ── Session-diff item data ─────────────────────────────────────────────────

export interface SessionDiffFile {
  file?: string;
  patch?: string;
  status?: string;
  additions?: number;
  deletions?: number;
}

// ── Model item data ────────────────────────────────────────────────────────

export interface ModelCapabilities {
  temperature?: boolean;
  reasoning?: boolean;
  attachment?: boolean;
  toolcall?: boolean;
  interleaved?: boolean;
  input?: Record<string, boolean>;
  output?: Record<string, boolean>;
}

export interface ModelLimit {
  context?: number;
  output?: number;
}

export interface ModelApiInfo {
  id?: string;
  npm?: string;
  url?: string;
}

export interface ModelVariantOptions {
  reasoningEffort?: string;
  reasoningSummary?: string;
  include?: string[];
}

export interface ModelInfo {
  id?: string;
  name?: string;
  providerID?: string;
  status?: string;
  family?: string;
  release_date?: string;
  api?: ModelApiInfo;
  capabilities?: ModelCapabilities;
  cost?: RawCostInfo;
  options?: Record<string, unknown>;
  limit?: ModelLimit;
  headers?: Record<string, unknown>;
  variants?: Record<string, ModelVariantOptions>;
}

// ── Top-level share items (discriminated on type) ──────────────────────────

export interface RawSessionItem {
  type: "session";
  data: RawSessionData;
}

export interface RawMessageItem {
  type: "message";
  data: RawMessageData;
}

/**
 * A part item.  The nested `data.type` further discriminates the part
 * subtype (text, reasoning, tool, …).  At the top level the only
 * guarantee is `type === "part"`.
 */
export interface RawPartItem {
  type: "part";
  data: RawPartData;
}

/**
 * `data` is an array of diff-file entries (NOT a single object).
 */
export interface RawSessionDiffItem {
  type: "session_diff";
  data: SessionDiffFile[];
}

/**
 * `data` is an array of model-info objects (NOT a single object).
 */
export interface RawModelItem {
  type: "model";
  data: ModelInfo[];
}

/**
 * Fallback for any future / unrecognised item type so that the union
 * never requires an exhaustive switch while still being type-safe.
 */
export interface RawUnknownItem {
  type: string;
  data: unknown;
}

// ── Union ──────────────────────────────────────────────────────────────────

export type RawShareItem =
  | RawSessionItem
  | RawMessageItem
  | RawPartItem
  | RawSessionDiffItem
  | RawModelItem
  | RawUnknownItem;

// ── Global augmentations ───────────────────────────────────────────────────

declare global {
  interface Window {
    SHARE_ID?: string;
  }
}
