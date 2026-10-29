import { describe, expect, it } from 'vitest';
import {
  compositionOfType,
  createEmptyProject,
  DEFAULT_OPENING_TYPES,
  makeWall,
  ProjectStore,
  type Opening,
  type OpeningType,
  type Project,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningModel } from './openingModelTypes.ts';

/*
 * Equivalência (spec F1 §7 e §8 item 10): gravar `composition = compositionOfType(tipo)` (o que a migração v19→v20 faz) NÃO muda
 * as peças geradas. Vale para todos os tipos antigos (sem composição no catálogo) em flipHand × flipFacing × alizar ligado/desligado.
 */
const ANTIGOS = DEFAULT_OPENING_TYPES.filter((t) => !t.composition);

function modelo(base: OpeningType, extra: Partial<OpeningType>, flipHand: boolean, flipFacing: boolean, migrado: boolean): OpeningModel {
  const s = new ProjectStore(createEmptyProject());
  const wallLen = 6;
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: wallLen, y: 0 } }) });
  const tipo: OpeningType = { ...base, id: 'ot_eq', ...extra };
  s.exec({ type: 'upsertOpeningType', openingType: tipo });
  s.exec({ type: 'addOpening', opening: { id: 'v', kind: base.kind, typeId: 'ot_eq', hostId: 'w', offset: 3, flipHand, flipFacing, sillOverride: null, mark: '' } });
  let p: Project = s.project;
  if (migrado) {
    const gravado = p.openingTypes.ot_eq!;
    p = { ...p, openingTypes: { ...p.openingTypes, ot_eq: { ...gravado, composition: compositionOfType(gravado) } } };
  }
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return buildOpeningModel(p, o, openingGeometry(p, o, f), f);
}

const norm = (m: OpeningModel) =>
  m.parts
    .map((q) => ({
      id: q.id,
      role: String(q.role),
      mat: q.material,
      grp: q.group ?? null,
      leaf: q.leaf ?? null,
      box: [q.box.t0, q.box.t1, q.box.s0, q.box.s1, q.box.z0, q.box.z1].map((x) => Math.round(x * 1e6) / 1e6),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

describe('equivalência da migração: tipos antigos geram as mesmas peças com composition = compositionOfType(tipo)', () => {
  it('há tipos antigos para comparar', () => {
    expect(ANTIGOS.length).toBeGreaterThanOrEqual(100);
  });

  for (const flips of [[false, false], [true, true]] as const) {
    it(`todos os tipos antigos, flipHand=${flips[0]} flipFacing=${flips[1]}`, () => {
      const dif: string[] = [];
      for (const t of ANTIGOS) {
        const a = modelo(t, {}, flips[0], flips[1], false);
        const b = modelo(t, {}, flips[0], flips[1], true);
        const na = JSON.stringify(norm(a));
        const nb = JSON.stringify(norm(b));
        if (na !== nb || a.width !== b.width || a.height !== b.height || a.openings.length !== b.openings.length) dif.push(t.id);
      }
      expect(dif, `tipos que mudaram: ${dif.join(', ')}`).toEqual([]);
    });
  }

  it('com alizar ligado também fica igual', () => {
    const dif: string[] = [];
    for (const t of ANTIGOS.filter((x) => x.leaves > 0)) {
      const extra = { casing: { width: 0.07, thickness: 0.015, sides: 'both' as const } };
      const a = modelo(t, extra, false, false, false);
      const b = modelo(t, extra, false, false, true);
      if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) dif.push(t.id);
    }
    expect(dif, `tipos que mudaram: ${dif.join(', ')}`).toEqual([]);
  });
});
