import { describe, expect, it } from 'vitest';
import raw from './fixtures/casa-2-quartos.hestia.json';
import { multiArea, intersection, union } from '@hestia/geom';
import { migrateProject, validateProject, type Project, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/** Arquivo real do usuário (casa de 2 quartos com ramal de concreto chegando num canto, em diagonal). */
const load = (): Project => migrateProject(JSON.parse(JSON.stringify(raw)));

const STEM = 'w_5eb8a1a71'; // concreto 15, termina sobre o eixo da diagonal
const THROUGH = 'w_bae74db32'; // alvenaria 14 em diagonal, chega ao canto da casa

const structure = (p: Project, id: string) => {
  const r = resolveLevel(p, 'lv_0', new Map());
  const w = r.walls[id]!;
  const type = p.wallTypes[(p.elements[id] as Wall).typeId]!;
  const idx = type.layers.findIndex((l) => l.function === 'structure');
  return w.layers.find((l) => l.layerIndex === idx)!.cut;
};

describe('arquivo real: ramal de concreto em T numa parede diagonal perto do canto', () => {
  // Com a junção ligada o T é reconhecido: a parede que atravessa continua e o ramal para na face. Com "não unir"
  // (estado original do arquivo) as duas se sobrepõem e o desempate fica por conta do núcleo mais grosso; o aviso
  // `wall-end-unjoined` (teste abaixo) é o que chama a atenção para isso.
  for (const noJoinEnd of [false]) {
    it(`núcleo da diagonal fica inteiro e o concreto para na face (noJoinEnd = ${noJoinEnd})`, () => {
      const p = load();
      (p.elements[STEM] as { noJoinEnd: boolean }).noJoinEnd = noJoinEnd;
      const alone = load();
      delete alone.elements[STEM];
      // Mesma área do núcleo da diagonal com e sem o ramal: o ramal não come o núcleo dela.
      expect(multiArea(structure(p, THROUGH))).toBeCloseTo(multiArea(structure(alone, THROUGH)), 5);
      // E os dois núcleos não se sobrepõem.
      expect(multiArea(intersection(structure(p, STEM), structure(p, THROUGH)))).toBeLessThan(1e-6);
    });
  }

  it('sem sobreposição entre camadas do aglomerado e sem exceções', () => {
    const r = resolveLevel(load(), 'lv_0', new Map());
    const areas = Object.values(r.walls).flatMap((w) => w.layers.map((l) => multiArea(l.cut)));
    const total = r.clusters.reduce((s, c) => s + multiArea(c.silhouette), 0);
    expect(areas.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 2);
    void union;
  });

  it('avisa quando a ponta desligada cai dentro de outra parede', () => {
    const issues = validateProject(load()).filter((i) => i.code === 'wall-end-unjoined');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.elementId).toBe(STEM);
    const p = load();
    (p.elements[STEM] as { noJoinEnd: boolean }).noJoinEnd = false;
    expect(validateProject(p).filter((i) => i.code === 'wall-end-unjoined')).toHaveLength(0);
  });
});
