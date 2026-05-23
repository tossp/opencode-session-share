import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import { normalizeShareItems, type NormalizedShareData } from './normalize';
import { buildTurns } from './turns';
import type { MessageInfo, RawPartData } from './types';

function message(id: string, role: string, created: number): MessageInfo {
  return { id, role, sessionID: 'ses_turns', time: { created } };
}

function textPart(id: string, messageID: string): RawPartData {
  return { id, type: 'text', messageID, sessionID: 'ses_turns', text: id };
}

function toolPart(id: string, messageID: string, input: string): RawPartData {
  return {
    id,
    type: 'tool',
    messageID,
    sessionID: 'ses_turns',
    tool: 'bash',
    state: { title: 'Run command', input },
  };
}

function normalized(messages: MessageInfo[], partsByMessageID: Record<string, RawPartData[]>): NormalizedShareData {
  return {
    messages,
    partsByMessageID,
    messagesBySessionID: { ses_turns: messages },
    sessionDiffs: [],
    models: [],
    rawIndex: { all: [], byType: {}, unknownTopLevel: [], malformed: [] },
    warnings: [],
  };
}

describe('buildTurns', () => {
  it('groups the real fixture user message with its following assistant message', () => {
    const data = normalizeShareItems(realShareFixture);
    const turns = buildTurns(data);

    expect(turns).toHaveLength(1);
    expect(turns[0].messageIDs).toEqual(['msg_user_001', 'msg_assistant_001']);
    expect(turns[0].messages.map((entry) => entry.message.role)).toEqual(['user', 'assistant']);
    expect(turns[0].assistants).toHaveLength(1);
    expect(turns[0].categorizedTools).toEqual([
      expect.objectContaining({ tool: 'bash', category: 'command' }),
    ]);
    expect(turns[0].messageStartIndex).toBe(0);
    expect(turns[0].messageEndIndex).toBe(1);
  });

  it('attaches consecutive assistant messages to the preceding user turn', () => {
    const messages = [message('user_1', 'user', 1), message('assistant_1', 'assistant', 2), message('assistant_2', 'assistant', 3)];
    const data = normalized(messages, {
      user_1: [textPart('text_user', 'user_1')],
      assistant_1: [toolPart('tool_test', 'assistant_1', 'pnpm test')],
      assistant_2: [toolPart('tool_patch', 'assistant_2', 'apply_patch update')],
    });

    const turns = buildTurns(data);

    expect(turns).toHaveLength(1);
    expect(turns[0].messageIDs).toEqual(['user_1', 'assistant_1', 'assistant_2']);
    expect(turns[0].assistants.map((entry) => entry.message.id)).toEqual(['assistant_1', 'assistant_2']);
    expect(turns[0].categorizedTools.map((tool) => tool.category)).toEqual(['verification', 'change']);
    expect(turns[0].messages.map((entry) => entry.messageIndex)).toEqual([0, 1, 2]);
  });

  it('creates separate turns for consecutive user messages even without assistants', () => {
    const messages = [message('user_1', 'user', 1), message('user_2', 'user', 2), message('assistant_1', 'assistant', 3)];
    const turns = buildTurns(normalized(messages, {}));

    expect(turns).toHaveLength(2);
    expect(turns[0].messageIDs).toEqual(['user_1']);
    expect(turns[0].assistants).toEqual([]);
    expect(turns[1].messageIDs).toEqual(['user_2', 'assistant_1']);
  });

  it('ignores assistant messages before the first user message', () => {
    const messages = [message('assistant_orphan', 'assistant', 1), message('user_1', 'user', 2), message('assistant_1', 'assistant', 3)];
    const turns = buildTurns(normalized(messages, {}));

    expect(turns).toHaveLength(1);
    expect(turns[0].messageIDs).toEqual(['user_1', 'assistant_1']);
    expect(turns[0].messageStartIndex).toBe(1);
    expect(turns[0].messageEndIndex).toBe(2);
  });

  it('preserves message order recoverably and does not mutate normalized inputs', () => {
    const messages = [message('user_1', 'user', 1), message('assistant_1', 'assistant', 2)];
    const partsByMessageID = { assistant_1: [toolPart('tool_1', 'assistant_1', 'pnpm build')] };
    const data = normalized(messages, partsByMessageID);
    const before = JSON.stringify(data);
    const turns = buildTurns(data);

    expect(turns[0].messages.map((entry) => data.messages[entry.messageIndex]?.id)).toEqual(['user_1', 'assistant_1']);
    expect(turns[0].messages[1].message).toBe(messages[1]);
    expect(turns[0].messages[1].parts[0]).toBe(partsByMessageID.assistant_1[0]);
    expect(JSON.stringify(data)).toBe(before);
  });
});
