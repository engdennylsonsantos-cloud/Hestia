import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingLinePaths } from './openingLines.ts';

interface Cena {
  p: Project;
  o: Opening;
}

function cena(base: string): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: base, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  return { p, o: p.elements.v as Opening };
}

const modelo = (c: Cena) => buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, frameOfWall(c.p, 'w')!), frameOfWall(c.p, 'w')!);
const PADRAO = { apex: 'latch', dashed: 'toward' } as const;
const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('linhas de abertura das janelas novas', () => {
  it('janela de abrir: um V de giro lateral por folha', () => {
    const m = modelo(cena('ot_ja120'));
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    for (const linha of linhas) {
      expect(linha.pts).toHaveLength(3);
      expect(linha.pts[0]!.z).toBeGreaterThan(linha.pts[1]!.z);
      expect(linha.pts[2]!.z).toBeLessThan(linha.pts[1]!.z);
    }
  });

  it('guilhotina: seta vertical (haste e ponta), sem seta horizontal', () => {
    const m = modelo(cena('ot_jg90'));
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    const haste = linhas.find((l) => l.pts.length === 2)!;
    expect(perto(haste.pts[0]!.u, haste.pts[1]!.u)).toBe(true);
    expect(Math.abs(haste.pts[0]!.z - haste.pts[1]!.z)).toBeGreaterThan(0.3);
    const ponta = linhas.find((l) => l.pts.length === 3)!;
    expect(perto(ponta.pts[0]!.z, ponta.pts[2]!.z)).toBe(true);
    expect(ponta.pts[1]!.z).toBeGreaterThan(ponta.pts[0]!.z);
  });

  it('pivotante: eixo vertical e V sobre o eixo', () => {
    const m = modelo(cena('ot_jp80'));
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    const eixo = linhas.find((l) => l.pts.length === 2)!;
    expect(perto(eixo.pts[0]!.u, eixo.pts[1]!.u)).toBe(true);
    const v = linhas.find((l) => l.pts.length === 3)!;
    expect(perto(v.pts[1]!.u, eixo.pts[0]!.u)).toBe(true);
  });

  it('veneziana: nenhuma linha de abertura (as aletas já mostram o movimento)', () => {
    const m = modelo(cena('ot_jv80'));
    expect(openingLinePaths(m, 1, PADRAO, 'elevation')).toHaveLength(0);
  });
});
