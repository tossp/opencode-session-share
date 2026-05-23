import { describe, expect, it } from 'vitest';
import { realShareFixture } from './fixtures/realShareFixture';
import type { RawShareItem } from './types';

const knownTopLevelTypes = new Set(['session', 'message', 'part', 'session_diff', 'model']);
const knownPartTypes = new Set([
  'text',
  'reasoning',
  'tool',
  'tool-call',
  'step-start',
  'step-finish',
  'patch',
  'compaction',
]);

function recordData(item: RawShareItem): Record<string, unknown> | undefined {
  if (typeof item.data !== 'object' || item.data === null || Array.isArray(item.data)) {
    return undefined;
  }

  return item.data as Record<string, unknown>;
}

function itemID(item: RawShareItem): string | undefined {
  const data = recordData(item);
  if (data === undefined || typeof data.id !== 'string') {
    return undefined;
  }

  return data.id;
}

function partType(item: RawShareItem): string | undefined {
  if (item.type !== 'part') {
    return undefined;
  }

  const data = recordData(item);
  return typeof data?.type === 'string' ? data.type : undefined;
}

function duplicateIDs(type: RawShareItem['type']): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of realShareFixture) {
    if (item.type !== type) {
      continue;
    }

    const id = itemID(item);
    if (id === undefined) {
      continue;
    }

    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }

    seen.add(id);
  }

  return [...duplicates];
}

describe('real share fixture', () => {
  it('is assignable to raw share items', () => {
    const fixture: RawShareItem[] = realShareFixture;

    expect(fixture.length).toBeGreaterThan(0);
  });

  it('contains duplicate session, message, and part rows for normalization tests', () => {
    expect(duplicateIDs('session')).toContain('ses_1acff78b2ffeecr9dduoDyoRXA');
    expect(duplicateIDs('message')).toContain('msg_user_001');
    expect(duplicateIDs('part')).toContain('prt_text_001');

    const duplicateParts = realShareFixture.filter(
      (item) => item.type === 'part' && item.data.id === 'prt_text_001',
    );

    expect(duplicateParts).toHaveLength(2);
    expect(duplicateParts[1]).toMatchObject({
      data: {
        metadata: { duplicateIntent: 'later-richer-version' },
        time: { updated: 1763243339000 },
      },
    });
  });

  it('keeps array-valued session_diff and model items', () => {
    const sessionDiff = realShareFixture.find((item) => item.type === 'session_diff');
    const model = realShareFixture.find((item) => item.type === 'model');

    expect(sessionDiff?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'frontend/src/shared/domain/fixtures/realShareFixture.ts' }),
      ]),
    );
    expect(model?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gpt-5.5', providerID: 'aio' }),
      ]),
    );
  });

  it('contains representative tool and patch parts', () => {
    const parts: RawShareItem[] = realShareFixture.filter((item) => item.type === 'part');

    expect(parts.some((item) => partType(item) === 'tool' && recordData(item)?.tool === 'bash')).toBe(true);
    expect(
      parts.some((item) => {
        const files = recordData(item)?.files;

        return (
          partType(item) === 'patch' &&
          Array.isArray(files) &&
          files.includes('frontend/src/shared/domain/fixtures/realShareFixture.ts')
        );
      }),
    ).toBe(true);
  });

  it('keeps unknown top-level and part subtype data for resilience checks', () => {
    const unknownTopLevel = realShareFixture.find((item) => !knownTopLevelTypes.has(item.type));
    const unknownPart = realShareFixture.find(
      (item) => item.type === 'part' && !knownPartTypes.has(partType(item) ?? ''),
    );

    expect(unknownTopLevel).toMatchObject({
      type: 'telemetry_event',
      data: expect.objectContaining({ id: 'evt_unknown_001' }),
    });
    expect(unknownPart).toMatchObject({
      type: 'part',
      data: expect.objectContaining({ type: 'image-preview', id: 'prt_unknown_001' }),
    });
  });
});
