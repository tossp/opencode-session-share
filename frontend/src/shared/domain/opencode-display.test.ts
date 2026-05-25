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

  it('validates the committed fixture without depending on local tmp payloads', () => {
    const document = convertOpenCodeShare(realShareFixture, { rootSessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA' });
    const plan = buildOpenCodeDisplayPlan(document);

    expect(document.rawLog.entries).toHaveLength(realShareFixture.length);
    expect(document.summary.kindCounts).toMatchObject({ session: 2, message: 3, session_diff: 1, model: 1 });
    expect(document.summary.modelCounts).toEqual({});
    expect(plan.debugRawRefs).toHaveLength(realShareFixture.length);
    expect(plan.toolGroups).toEqual([expect.objectContaining({ tools: ['bash'], statuses: ['completed'] })]);
    expect(plan.fileChanges.map((change) => change.file)).toEqual([
      'frontend/src/shared/domain/fixtures/README.md',
      'frontend/src/shared/domain/fixtures/realShareFixture.ts',
    ]);
  });
});
