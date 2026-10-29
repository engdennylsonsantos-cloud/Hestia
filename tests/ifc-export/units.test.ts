import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { projectIfc } from '../../apps/web/src/editor/ifcExport.ts';

const DATA = new Date('2026-10-29T00:00:00Z');

describe('unidades e norte verdadeiro', () => {
  it('declara metro, metro², metro³ e radiano', () => {
    const text = projectIfc(buildTemplate('house2'), DATA);
    expect((text.match(/=IFCSIUNIT\(/g) ?? []).length).toBe(4);
    expect(text).toContain('.AREAUNIT.');
    expect(text).toContain('.VOLUMEUNIT.');
    expect(text).toContain('.PLANEANGLEUNIT.');
    expect(text).toContain('.SQUARE_METRE.');
    expect(text).toContain('.CUBIC_METRE.');
  });

  it('o contexto de geometria tem norte verdadeiro (0,1)', () => {
    const text = projectIfc(buildTemplate('house2'), DATA);
    expect(text).toContain('IFCDIRECTION((0.000000,1.000000))');
  });
});
