import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type OpeningType, type Project } from '@hestia/model';
import { quantifyLevel, resolveLevel } from './index.ts';
import { frameOfWall, openingGeometry } from './resolve.ts';

/** Parede de 4 m com uma porta no meio; o tipo ganha a folga de vão bruto pedida. */
function comFolga(roughOversize?: { w: number; h: number }): Project {
  const s = new ProjectStore(createEmptyProject());
  if (roughOversize) {
    const base = s.project.openingTypes.ot_p80!;
    s.exec({ type: 'upsertOpeningType', openingType: { ...base, id: 'ot_bruto', roughOversize } });
  }
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: roughOversize ? 'ot_bruto' : 'ot_p80', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  return s.project;
}

const cutArea = (p: Project): number => {
  const r = resolveLevel(p, 'lv_0', new Map());
  return r.walls.w!.layers.reduce((sum, l) => sum + multiArea(l.cut), 0);
};

/** Volume só do bloco estrutural (a camada que o furo atravessa inteira; os acabamentos têm retorno no vão). */
const volumeBloco = (p: Project): number => {
  const q = quantifyLevel(p, resolveLevel(p, 'lv_0', new Map()));
  return q.layers.filter((l) => l.materialId === 'mat_bloco14').reduce((sum, l) => sum + l.volume, 0);
};

const espessura = (p: Project): number => Object.values(p.wallTypes.wt_alv14!.layers).reduce((s, l) => s + l.thickness, 0);

const esp = (p: Project, id: string): OpeningType => p.openingTypes[id]!;

describe('vão bruto (roughOversize)', () => {
  it('sem o campo, o furo é a largura × altura do tipo e a esquadria não muda', () => {
    const p = comFolga();
    const t = esp(p, 'ot_p80');
    const g = openingGeometry(p, p.elements.d as never, frameOfWall(p, 'w')!);
    expect(g.width).toBeCloseTo(t.width, 9);
    expect(g.height).toBeCloseTo(t.height, 9);
    expect(g.roughWidth).toBeCloseTo(t.width, 9);
    expect(g.roughHeight).toBeCloseTo(t.height, 9);
  });

  it('a folga cresce só o furo: largura na planta e altura no volume da parede', () => {
    const base = comFolga();
    const largo = comFolga({ w: 0.1, h: 0 });
    const alto = comFolga({ w: 0, h: 0.1 });
    const semFolga = cutArea(base);
    expect(semFolga - cutArea(largo)).toBeCloseTo(0.1 * espessura(base), 6); // o furo maior tira parede
    expect(cutArea(alto)).toBeCloseTo(semFolga, 6); // a altura não muda o recorte da planta
    // Os retornos do acabamento (reboco e tinta) ocupam parte do furo; o bloco estrutural perde o furo inteiro.
    expect(volumeBloco(base) - volumeBloco(alto)).toBeCloseTo(0.8 * 0.1 * 0.14, 6);
    expect(volumeBloco(largo) - volumeBloco(base)).toBeCloseTo(-0.1 * 2.1 * 0.14, 6);
  });

  it('o vão bruto chega ao `OpeningGeometry` e a esquadria continua com a medida do tipo', () => {
    const p = comFolga({ w: 0.04, h: 0.06 });
    const g = openingGeometry(p, p.elements.d as never, frameOfWall(p, 'w')!);
    expect(g.width).toBeCloseTo(0.8, 9);
    expect(g.height).toBeCloseTo(2.1, 9);
    expect(g.roughWidth).toBeCloseTo(0.84, 9);
    expect(g.roughHeight).toBeCloseTo(2.16, 9);
  });
});
