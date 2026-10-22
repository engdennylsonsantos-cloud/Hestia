import { describe, expect, it } from 'vitest';
import { en, list, num, OMIT, ref, StepWriter, stepString } from './ifcStep.ts';

describe('ifcStep', () => {
  it('num: 6 casas, ponto decimal e zero sem sinal', () => {
    expect(num(1)).toBe('1.000000');
    expect(num(-0.0000001)).toBe('0.000000');
    expect(num(2.5)).toBe('2.500000');
    expect(() => num(Number.NaN)).toThrow();
  });

  it('stepString: apóstrofo dobra e acento vai em \\X2\\ UTF-16', () => {
    expect(stepString("it's")).toBe("'it''s'");
    expect(stepString('Térreo')).toBe("'T\\X2\\00E9\\X0\\rreo'");
    expect(stepString('a\\b')).toBe("'a\\\\b'");
  });

  it('escritor: ids sequenciais a partir de #1 e texto com cabeçalho e rodapé', () => {
    const w = new StepWriter();
    const a = w.add('IFCSIUNIT', ['*', en('LENGTHUNIT'), OMIT, en('METRE')]);
    const b = w.add('IFCUNITASSIGNMENT', [list([ref(a)])]);
    expect([a, b]).toEqual([1, 2]);
    const text = w.text({ fileName: 'x.ifc', timestamp: '2026-01-01T00:00:00' });
    expect(text.startsWith('ISO-10303-21;\nHEADER;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'));");
    expect(text).toContain('#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);');
    expect(text).toContain('#2=IFCUNITASSIGNMENT((#1));');
    expect(text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
  });
});
