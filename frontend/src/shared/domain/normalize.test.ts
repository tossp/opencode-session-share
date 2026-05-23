import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import { normalizeShareItems } from './normalize';
import type { RawShareItem } from './types';

function fixturePartText(index: number): string | undefined {
  const item = realShareFixture[index];
  if (item?.type !== 'part' || !isRecord(item.data)) {
    return undefined;
  }

  return typeof item.data.text === 'string' ? item.data.text : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('normalizeShareItems', () => {
  it('dedupes sessions, messages, and parts from the real fixture', () => {
    const normalized = normalizeShareItems(realShareFixture);

    expect(normalized.session).toMatchObject({
      id: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      title: 'Inspect shared session data - richer duplicate',
      directory: '/root/proj/ocshare',
      time: { updated: 1763243600000 },
    });
    expect(normalized.messages.map((message) => message.id)).toEqual(['msg_user_001', 'msg_assistant_001']);
    expect(normalized.messagesBySessionID.ses_1acff78b2ffeecr9dduoDyoRXA).toHaveLength(2);
    expect(normalized.partsByMessageID.msg_user_001.map((part) => part.id)).toEqual(['prt_text_001']);
  });

  it('uses the richer later duplicate part without mutating input data', () => {
    const originalText = fixturePartText(5);
    const normalized = normalizeShareItems(realShareFixture);
    const userPart = normalized.partsByMessageID.msg_user_001[0];

    expect(userPart).toMatchObject({
      id: 'prt_text_001',
      text: 'Please add representative fixture tests and keep the payload compact.',
      time: { created: 1763243331000, updated: 1763243339000 },
      metadata: { duplicateIntent: 'later-richer-version' },
    });
    expect(fixturePartText(5)).toBe(originalText);
  });

  it('keeps original part order for a message and falls back to time on ties', () => {
    const normalized = normalizeShareItems(realShareFixture);
    const assistantPartIDs = normalized.partsByMessageID.msg_assistant_001.map((part) => part.id);

    expect(assistantPartIDs).toEqual([
      'prt_reasoning_001',
      'prt_tool_001',
      'prt_patch_001',
      'prt_step_start_001',
      'prt_step_finish_001',
      'prt_unknown_001',
    ]);
  });

  it('warns for unknown top-level items and unknown part subtypes while preserving raw index data', () => {
    const normalized = normalizeShareItems(realShareFixture);

    expect(normalized.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unknown_top_level_type', index: 15, type: 'telemetry_event' }),
        expect.objectContaining({ code: 'unknown_part_type', index: 12, type: 'part', path: 'data.type' }),
      ]),
    );
    expect(normalized.rawIndex.unknownTopLevel).toEqual([
      expect.objectContaining({ index: 15, type: 'telemetry_event' }),
    ]);
    expect(normalized.rawIndex.byType.part).toHaveLength(8);
    expect(normalized.partsByMessageID.msg_assistant_001).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'prt_unknown_001', type: 'image-preview' })]),
    );
  });

  it('does not throw for malformed known items and records warnings', () => {
    const malformedItems = [
      { type: 'message', data: null },
      { type: 'part', data: { id: 'prt_missing_message', type: 'text' } },
      { type: 'session_diff', data: [{ patch: '@@ no file @@' }, null] },
      { type: 'model', data: 'not-array' },
    ] as RawShareItem[];

    expect(() => normalizeShareItems(malformedItems)).not.toThrow();

    const normalized = normalizeShareItems(malformedItems);
    expect(normalized.warnings.map((warning) => warning.code)).toEqual([
      'malformed_data',
      'malformed_data',
      'malformed_data',
      'malformed_data',
    ]);
    expect(normalized.rawIndex.malformed).toHaveLength(4);
    expect(normalized.messages).toEqual([]);
    expect(normalized.partsByMessageID).toEqual({});
  });

  it('merges session_diff arrays by file and dedupes model arrays', () => {
    const items = [
      ...realShareFixture,
      {
        type: 'session_diff',
        data: [
          {
            file: 'frontend/src/shared/domain/fixtures/realShareFixture.ts',
            patch: '@@ richer duplicate patch @@',
            status: 'modified',
            additions: 22,
            deletions: 1,
          },
        ],
      },
      {
        type: 'model',
        data: [
          {
            id: 'gpt-5.5',
            providerID: 'aio',
            name: 'GPT 5.5 richer',
            limit: { output: 16384 },
          },
          {
            id: 'claude-sonnet-4.5',
            providerID: 'anthropic',
            name: 'Claude Sonnet 4.5',
          },
        ],
      },
    ] satisfies RawShareItem[];

    const normalized = normalizeShareItems(items);

    expect(normalized.sessionDiffs).toHaveLength(2);
    expect(normalized.sessionDiffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'frontend/src/shared/domain/fixtures/realShareFixture.ts',
          patch: '@@ richer duplicate patch @@',
          status: 'modified',
          additions: 22,
        }),
      ]),
    );
    expect([...normalized.models.map((model) => `${model.providerID}/${model.id}`)].sort()).toEqual([
      'aio/gpt-5.5',
      'anthropic/claude-sonnet-4.5',
    ]);
    expect(normalized.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gpt-5.5',
          name: 'GPT 5.5',
          limit: { context: 128000, output: 8192 },
        }),
        expect.objectContaining({ id: 'claude-sonnet-4.5', providerID: 'anthropic' }),
      ]),
    );
  });
});
