import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import { buildRenderItems, convertOpenCodeShare } from './opencode';
import type { RawShareItem } from './types';

describe('convertOpenCodeShare', () => {
  it('preserves every raw item and source index from fixture data', () => {
    const document = convertOpenCodeShare(realShareFixture, { rootSessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA' });

    expect(document.rawLog.entries).toHaveLength(realShareFixture.length);
    expect(document.rawLog.sourceItems).toBe(realShareFixture);
    expect(document.rawLog.entries.map((entry) => entry.rawIndex)).toEqual(realShareFixture.map((_, index) => index));
    expect(document.summary.totalEntries).toBe(realShareFixture.length);
  });

  it('keeps unknown top-level and unknown part data addressable', () => {
    const document = convertOpenCodeShare(realShareFixture);

    expect(document.rawLog.byKind.unknown_top_level?.[0].label).toBe('telemetry_event');
    expect(document.rawLog.byKind.unknown_part?.[0].label).toBe('image-preview');
    expect(document.summary.kindCounts.unknown_top_level).toBe(1);
    expect(document.summary.kindCounts.unknown_part).toBe(1);
  });

  it('builds latest message envelopes while preserving part source indexes', () => {
    const document = convertOpenCodeShare(realShareFixture);
    const first = document.visibleMessages[0];

    expect(document.latest.messageEnvelopes).toHaveLength(2);
    expect(first.parts.length).toBeGreaterThan(0);
    expect(Object.values(first.partSourceIndexes).every((indexes) => indexes.length > 0)).toBe(true);
  });

  it('counts models per message instead of assuming one session model', () => {
    const items = [
      { type: 'session', data: { id: 'ses_models' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_models', role: 'user', model: { providerID: 'aio', modelID: 'gpt-5.5' } } },
      { type: 'message', data: { id: 'msg_a', sessionID: 'ses_models', role: 'assistant', parentID: 'msg_user', providerID: 'aio', modelID: 'gpt-5.5' } },
      { type: 'message', data: { id: 'msg_b', sessionID: 'ses_models', role: 'assistant', parentID: 'msg_user', providerID: 'aio', modelID: 'gpt-5.4' } },
    ] satisfies RawShareItem[];

    const document = convertOpenCodeShare(items);

    expect(document.summary.modelCounts).toEqual({ 'aio/gpt-5.4': 1, 'aio/gpt-5.5': 2 });
  });

  it('keeps tool lifecycle history and raw object input intact', () => {
    const items = [
      { type: 'session', data: { id: 'ses_tool' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_tool', role: 'user' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_tool', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'part_tool', sessionID: 'ses_tool', messageID: 'msg_assistant', type: 'tool', tool: 'bash', callID: 'call_1', state: { status: 'running', input: { command: 'pnpm test' } } } },
      { type: 'part', data: { id: 'part_tool', sessionID: 'ses_tool', messageID: 'msg_assistant', type: 'tool', tool: 'bash', callID: 'call_1', state: { status: 'completed', input: { command: 'pnpm test' }, output: 'ok' } } },
    ] satisfies RawShareItem[];

    const document = convertOpenCodeShare(items);
    const tool = document.tools[0];

    expect(document.latest.parts['msg_assistant/part_tool'].history.map((entry) => entry.sourceIndex.rawItemIndex)).toEqual([3, 4]);
    expect(tool.rawInput).toEqual({ command: 'pnpm test' });
    expect(tool.rawOutput).toBe('ok');
    expect(tool.status).toBe('completed');
  });

  it('groups only consecutive tool parts without dropping non-tool parts', () => {
    const items = buildRenderItems([
      { id: 'text_1', messageID: 'msg', type: 'text', text: 'hello' },
      { id: 'tool_1', messageID: 'msg', type: 'tool', tool: 'read' },
      { id: 'tool_2', messageID: 'msg', type: 'tool', tool: 'grep' },
      { id: 'finish_1', messageID: 'msg', type: 'step-finish', reason: 'stop' },
    ]);

    expect(items.map((item) => item.type)).toEqual(['single', 'tool-group', 'single']);
    expect(items[1]).toMatchObject({ type: 'tool-group', parts: [{ id: 'tool_1' }, { id: 'tool_2' }] });
  });

  it('creates graph edges for session, message, part, and assistant parent relationships', () => {
    const document = convertOpenCodeShare(realShareFixture);
    const edgeTypes = new Set(document.graph.edges.map((edge) => edge.type));

    expect(edgeTypes.has('session_message')).toBe(true);
    expect(edgeTypes.has('message_part')).toBe(true);
    expect(edgeTypes.has('assistant_parent')).toBe(true);
  });

  it('keeps graph edge endpoints resolvable to canonical nodes or update history nodes', () => {
    const items = [
      { type: 'session', data: { id: 'ses_graph' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_graph', role: 'user' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_graph', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'part_tool', sessionID: 'ses_graph', messageID: 'msg_assistant', type: 'tool', tool: 'read', state: { status: 'running' } } },
      { type: 'part', data: { id: 'part_tool', sessionID: 'ses_graph', messageID: 'msg_assistant', type: 'tool', tool: 'read', state: { status: 'completed' } } },
    ] satisfies RawShareItem[];
    const document = convertOpenCodeShare(items);
    const nodeIDs = new Set(document.graph.nodes.map((node) => node.id));

    for (const edge of document.graph.edges.filter((edge) => edge.type !== 'same_identity_update')) {
      expect(nodeIDs.has(edge.from)).toBe(true);
      expect(nodeIDs.has(edge.to)).toBe(true);
    }
    expect(document.graph.edges.some((edge) => edge.type === 'same_identity_update')).toBe(true);
  });

  it('maps raw metadata by top-level type instead of assigning session ids as message ids', () => {
    const document = convertOpenCodeShare([{ type: 'session', data: { id: 'ses_meta' } }]);
    const entry = document.rawLog.entries[0];

    expect(entry.sessionID).toBe('ses_meta');
    expect(entry.messageID).toBeUndefined();
    expect(entry.itemID).toBe('ses_meta');
  });

  it('keeps malformed identity records in latest state with source-index fallback keys', () => {
    const document = convertOpenCodeShare([
      { type: 'session', data: { id: 'ses_missing' } },
      { type: 'message', data: { sessionID: 'ses_missing', role: 'user' } },
      { type: 'part', data: { type: 'text', text: 'orphan text' } },
    ] as RawShareItem[]);

    expect(document.latest.messages['message:1'].current.role).toBe('user');
    expect(document.latest.parts['part:2'].current.type).toBe('text');
  });

  it('does not report unknown total cost as zero', () => {
    const document = convertOpenCodeShare([
      { type: 'session', data: { id: 'ses_cost' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_cost', role: 'user' } },
    ]);

    expect(document.summary.totalCost).toBeUndefined();
  });
});
