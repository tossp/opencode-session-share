import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import { convertOpenCodeShare } from './opencode';
import { buildOpenCodeReaderPlan, detectInjectedMessage } from './opencode-reader';
import type { RawShareItem } from './types';

describe('buildOpenCodeReaderPlan', () => {
  it('keeps real user input in the main narrative with provenance', () => {
    const items = [
      { type: 'session', data: { id: 'ses_reader' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_reader', role: 'user', content: 'Fix the lint error' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_reader', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_reader', messageID: 'msg_assistant', type: 'text', text: 'Done.' } },
    ] satisfies RawShareItem[];

    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(items));

    expect(plan.mainNarrative.map((item) => [item.kind, item.id, item.text])).toEqual([
      ['real_user_input', 'msg_user', 'Fix the lint error'],
      ['assistant_response', 'msg_assistant', 'Done.'],
    ]);
    expect(plan.provenance.byNarrativeID.msg_user).toEqual([{ rawItemIndex: 1 }]);
  });

  it('moves OC and OMO injected user reminders out of the main narrative', () => {
    const reminder = '<system-reminder>\n[ALL BACKGROUND TASKS COMPLETE]\nUse `background_output(task_id="bg_1")`.\n</system-reminder>\n<!-- OMO_INTERNAL_INITIATOR -->';
    const items = [
      { type: 'session', data: { id: 'ses_injection' } },
      { type: 'message', data: { id: 'msg_real', sessionID: 'ses_injection', role: 'user', content: '继续' } },
      { type: 'message', data: { id: 'msg_injected', sessionID: 'ses_injection', role: 'user' } },
      { type: 'part', data: { id: 'part_injected', sessionID: 'ses_injection', messageID: 'msg_injected', type: 'text', text: reminder } },
      { type: 'message', data: { id: 'msg_after_injection', sessionID: 'ses_injection', role: 'assistant', parentID: 'msg_injected' } },
      { type: 'part', data: { id: 'part_after', sessionID: 'ses_injection', messageID: 'msg_after_injection', type: 'text', text: 'Collected result.' } },
    ] satisfies RawShareItem[];

    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(items));

    expect(plan.mainNarrative.map((item) => item.id)).toEqual(['msg_real']);
    expect(plan.injectedMessages).toHaveLength(1);
    expect(plan.injectedMessages[0]).toMatchObject({ id: 'msg_injected', detection: { isInjected: true } });
    expect(plan.injectedMessages[0].detection.kinds).toEqual(['system_reminder', 'omo_internal', 'background_task']);
    expect(plan.sideEvents.map((event) => [event.kind, event.id])).toEqual([
      ['injected_message', 'msg_injected'],
      ['assistant_after_injection', 'msg_after_injection'],
    ]);
  });

  it('classifies reasoning and step parts as side events while preserving assistant text', () => {
    const items = [
      { type: 'session', data: { id: 'ses_side' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_side', role: 'user', content: 'go' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_side', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'reasoning_1', sessionID: 'ses_side', messageID: 'msg_assistant', type: 'reasoning', text: 'thinking' } },
      { type: 'part', data: { id: 'step_1', sessionID: 'ses_side', messageID: 'msg_assistant', type: 'step-start', snapshot: 'snap' } },
      { type: 'part', data: { id: 'step_2', sessionID: 'ses_side', messageID: 'msg_assistant', type: 'step-finish', reason: 'stop' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_side', messageID: 'msg_assistant', type: 'text', text: 'result' } },
    ] satisfies RawShareItem[];

    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(items));

    expect(plan.mainNarrative.find((item) => item.id === 'msg_assistant')?.text).toBe('result');
    expect(plan.sideEvents.map((event) => [event.kind, event.id, event.messageID])).toEqual([
      ['reasoning_part', 'msg_assistant:reasoning_1', 'msg_assistant'],
      ['step_start', 'msg_assistant:step_1', 'msg_assistant'],
      ['step_finish', 'msg_assistant:step_2', 'msg_assistant'],
    ]);
    expect(plan.provenance.bySideEventID['msg_assistant:reasoning_1']).toEqual([{ rawItemIndex: 3 }]);
  });

  it('keeps tool lifecycle as reader tool runs with main or side association', () => {
    const items = [
      { type: 'session', data: { id: 'ses_toolrun' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_toolrun', role: 'user', content: 'run tests' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_toolrun', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'tool_1', sessionID: 'ses_toolrun', messageID: 'msg_assistant', type: 'tool', tool: 'bash', callID: 'call_1', state: { status: 'running', input: { command: 'pnpm test' } } } },
      { type: 'part', data: { id: 'tool_1', sessionID: 'ses_toolrun', messageID: 'msg_assistant', type: 'tool', tool: 'bash', callID: 'call_1', state: { status: 'completed', input: { command: 'pnpm test' }, output: 'ok' } } },
    ] satisfies RawShareItem[];

    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(items));

    expect(plan.toolRuns).toEqual([
      expect.objectContaining({ callID: 'call_1', tool: 'bash', status: 'completed', narrativeMessageID: 'msg_assistant' }),
    ]);
    expect(plan.toolRuns[0].sourceIndexes).toEqual([{ rawItemIndex: 3 }, { rawItemIndex: 4 }]);
  });

  it('keeps every semantic source index traceable to the fixture raw items', () => {
    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(realShareFixture));
    const allIndexes = plan.mainNarrative
      .reduce((indexes, item) => indexes.concat(item.sourceIndexes), [] as Array<{ rawItemIndex: number }>)
      .concat(plan.injectedMessages.reduce((indexes, item) => indexes.concat(item.sourceIndexes), [] as Array<{ rawItemIndex: number }>))
      .concat(plan.sideEvents.reduce((indexes, event) => indexes.concat(event.sourceIndexes), [] as Array<{ rawItemIndex: number }>))
      .concat(plan.toolRuns.reduce((indexes, tool) => indexes.concat(tool.sourceIndexes), [] as Array<{ rawItemIndex: number }>));

    expect(allIndexes.length).toBeGreaterThan(0);
    expect(allIndexes.every((index) => index.rawItemIndex >= 0 && index.rawItemIndex < realShareFixture.length)).toBe(true);
  });

  it('recognizes current OMO system-reminder text directly', () => {
    const detection = detectInjectedMessage(
      { id: 'msg', role: 'user' },
      [{ id: 'part', messageID: 'msg', type: 'text', text: '<system-reminder>\n[BACKGROUND TASK COMPLETED]\n</system-reminder>\n<!-- OMO_INTERNAL_INITIATOR -->' }],
    );

    expect(detection).toMatchObject({ isInjected: true, kinds: ['system_reminder', 'omo_internal', 'background_task'] });
  });

  it('classifies compaction parts as side events with provenance', () => {
    const items = [
      { type: 'session', data: { id: 'ses_compaction' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_compaction', role: 'user', content: 'process data' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_compaction', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_compaction', messageID: 'msg_assistant', type: 'text', text: 'Processing...' } },
      { type: 'part', data: { id: 'compaction_1', sessionID: 'ses_compaction', messageID: 'msg_assistant', type: 'compaction', marker: 'compaction_continue' } },
      { type: 'part', data: { id: 'text_2', sessionID: 'ses_compaction', messageID: 'msg_assistant', type: 'text', text: 'Compaction complete.' } },
    ] satisfies RawShareItem[];

    const plan = buildOpenCodeReaderPlan(convertOpenCodeShare(items));

    expect(plan.mainNarrative.find((item) => item.id === 'msg_assistant')?.text).toBe('Processing...\nCompaction complete.');
    expect(plan.sideEvents.map((event) => [event.kind, event.id, event.messageID])).toEqual([
      ['compaction_part', 'msg_assistant:compaction_1', 'msg_assistant'],
    ]);
    expect(plan.provenance.bySideEventID['msg_assistant:compaction_1']).toEqual([{ rawItemIndex: 4 }]);
  });

  it('keeps unknown part types visible in debug data without breaking narrative', () => {
    const items = [
      { type: 'session', data: { id: 'ses_unknown' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_unknown', role: 'user', content: 'test unknown' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_unknown', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_unknown', messageID: 'msg_assistant', type: 'text', text: 'Known text' } },
      { type: 'part', data: { id: 'unknown_1', sessionID: 'ses_unknown', messageID: 'msg_assistant', type: 'unknown-subtype', custom: 'data' } },
      { type: 'part', data: { id: 'text_2', sessionID: 'ses_unknown', messageID: 'msg_assistant', type: 'text', text: 'More known text' } },
    ] satisfies RawShareItem[];

    const document = convertOpenCodeShare(items);
    const plan = buildOpenCodeReaderPlan(document);

    expect(plan.mainNarrative.map((item) => item.text)).toEqual(['test unknown', 'Known text\nMore known text']);
    expect(document.rawLog.byKind.unknown_part?.[0].label).toBe('unknown-subtype');
    expect(document.summary.kindCounts.unknown_part).toBe(1);
  });

  it('handles genuinely malformed items and exposes them in warnings and raw log', () => {
    const items = [
      { type: 'session', data: { id: 'ses_malformed' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_malformed', role: 'user', content: 'test malformed' } },
      { type: 'message', data: 'not-an-object' },
      { type: 'part', data: { id: 'part_ok', sessionID: 'ses_malformed', messageID: 'msg_user', type: 'text', text: 'valid part' } },
      { type: 'part', data: 'also-not-an-object' },
    ] satisfies RawShareItem[];

    const document = convertOpenCodeShare(items);
    const plan = buildOpenCodeReaderPlan(document);

    expect(document.warnings.some((w) => w.code === 'malformed_data')).toBe(true);
    expect(document.rawLog.byKind.malformed).toHaveLength(1);
    expect(document.rawLog.entries.some((entry) => entry.kind === 'malformed')).toBe(true);
    expect(plan.mainNarrative.length).toBe(1);
});

});