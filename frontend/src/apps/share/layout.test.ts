import { describe, expect, it } from 'vitest';
import { buildNavSections, demoTurns, sectionID } from './layout';

describe('share layout anchor mapping', () => {
  it('generates stable section ids from turn ids', () => {
    expect(sectionID('Turn: Alpha / Beta')).toBe('turn-turn-alpha-beta');
    expect(sectionID('   ')).toBe('turn-section');
  });

  it('creates one nav anchor for every demo timeline turn', () => {
    const sections = buildNavSections(demoTurns);

    expect(sections.map((section) => section.id)).toEqual(demoTurns.map((turn) => sectionID(turn.id)));
    expect(new Set(sections.map((section) => section.id)).size).toBe(demoTurns.length);
    expect(sections.every((section) => section.label.length > 0 && section.meta.length > 0)).toBe(true);
  });
});
