import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import { buildOpenCodeDisplayPlan } from './opencode-display';
import { convertOpenCodeShare } from './opencode';
import type { RawShareItem } from './types';

describe('buildOpenCodeDisplayPlan', () => {
  it('derives timeline, outline, tool groups, model usage, and raw refs from fixture data', () => {
    const document = convertOpenCodeShare(realShareFixture);
    const plan = buildOpenCodeDisplayPlan(document);

    expect(plan.timeline).toHaveLength(1);
    expect(plan.outline).toHaveLength(plan.timeline.length);
    expect(plan.toolGroups.length).toBeGreaterThan(0);
    expect(plan.overview.counts).toContainEqual({ label: 'message', value: '3' });
    expect(plan.debugRawRefs).toHaveLength(realShareFixture.length);
    expect(plan.warnings.some((warning) => warning.kind === 'unknown_part')).toBe(true);
  });

  it('keeps consecutive tool parts grouped while retaining surrounding non-tool parts', () => {
    const document = convertOpenCodeShare([
      { type: 'session', data: { id: 'ses_display' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_display', role: 'user', content: 'start' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_display', role: 'assistant', parentID: 'msg_user', providerID: 'aio', modelID: 'gpt-5.5' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_display', messageID: 'msg_assistant', type: 'text', text: 'before' } },
      { type: 'part', data: { id: 'tool_1', sessionID: 'ses_display', messageID: 'msg_assistant', type: 'tool', tool: 'read', state: { status: 'completed' } } },
      { type: 'part', data: { id: 'tool_2', sessionID: 'ses_display', messageID: 'msg_assistant', type: 'tool', tool: 'grep', state: { status: 'completed' } } },
      { type: 'part', data: { id: 'finish_1', sessionID: 'ses_display', messageID: 'msg_assistant', type: 'step-finish', reason: 'stop' } },
    ] satisfies RawShareItem[]);
    const plan = buildOpenCodeDisplayPlan(document);

    expect(plan.timeline).toHaveLength(1);
    expect(plan.timeline[0].toolCount).toBe(2);
    expect(plan.toolGroups).toEqual([
      expect.objectContaining({ messageID: 'msg_assistant', tools: ['read', 'grep'], statuses: ['completed', 'completed'] }),
    ]);
  });

  it('validates the full cached raw payload without embedding it in source', () => {
    const rawPath = resolve(process.cwd(), '..', 'tmp', 'ses_1acff78b2ffeecr9dduoDyoRXA.raw.json');
    const items = JSON.parse(readFileSync(rawPath, 'utf8')) as RawShareItem[];
    const document = convertOpenCodeShare(items, { rootSessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA' });
    const plan = buildOpenCodeDisplayPlan(document);

    expect(document.rawLog.entries).toHaveLength(2244);
    expect(document.summary.kindCounts).toMatchObject({ session: 141, message: 472, tool: 596, session_diff: 138, model: 141 });
    expect(rawModelCounts(items)).toEqual({ 'aio/gpt-5.4': 2, 'aio/gpt-5.5': 470 });
    expect(document.summary.modelCounts).toEqual({ 'aio/gpt-5.4': 2, 'aio/gpt-5.5': 203 });
    expect(plan.debugRawRefs).toHaveLength(2244);
    expect(plan.toolGroups.length).toBeGreaterThan(100);
    expect(plan.fileChanges.length).toBeGreaterThan(0);
  });
});

function rawModelCounts(items: readonly RawShareItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.type !== 'message' || !isRecord(item.data)) continue;
    const model = isRecord(item.data.model) ? item.data.model : undefined;
    const providerID = stringValue(item.data.providerID) ?? stringValue(model?.providerID);
    const modelID = stringValue(item.data.modelID) ?? stringValue(model?.modelID);
    if (providerID === undefined && modelID === undefined) continue;
    const label = `${providerID ?? ''}/${modelID ?? ''}`;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, number>>((result, [label, value]) => {
      result[label] = value;
      return result;
    }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
