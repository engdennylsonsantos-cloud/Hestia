import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WALL_TYPES,
  coreSpan,
  createEmptyProject,
  makeWall,
  ProjectStore,
  totalThickness,
  type Layer,
  type Opening,
  type OpeningType,
  type Project,
  type WallType,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningPart } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

/** Parede de 4 m com um vão do tipo `base` no meio, no tipo de parede `wallTypeId`. */
function cena(base: string, wallTypeId: string, extra: Partial<OpeningType> = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: wallTypeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), t: p.openingTypes.ot_x! };
}

const jamb = (c: Cena): OpeningPart => {
  const m = buildOpeningModel(c.p, c.o, c.g, frameOfWall(c.p, 'w')!);
  const part = m.parts.find((x) => x.role === 'jamb');
  if (!part) throw new Error(`sem ombreira (tipo ${c.t.id}/${c.o.typeId}); papéis: ${m.parts.map((x) => x.role).join(',')} vão=${c.g.width}x${c.g.height}`);
  return part;
};

const espessuraDoBatente = (c: Cena): number => {
  const b = jamb(c).box;
  return b.s1 - b.s0;
};

const centroDoBatente = (c: Cena): number => {
  const b = jamb(c).box;
  return (b.s0 + b.s1) / 2;
};

/** Uma porta de madeira, uma porta-balcão (madeira e vidro), uma janela de correr e uma maxim-ar do catálogo. */
const TIPOS = ['ot_p90', 'ot_pbalcao120', 'ot_jc2_120x100', 'ot_jm_80x80'] as const;

const umaCamada: WallType = {
  ...DEFAULT_WALL_TYPES[0]!,
  id: 'wt_uma',
  name: 'Concreto de uma camada',
  layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false } satisfies Layer],
};

describe('batente por frameDepthMode em todos os tipos de parede do catálogo', () => {
  for (const wall of DEFAULT_WALL_TYPES) {
    for (const base of TIPOS) {
      it(`${base} em ${wall.id}: padrão = espessura acabada; core = núcleo`, () => {
        const total = totalThickness(wall);
        const core = coreSpan(wall);
        const centroNucleo = total / 2 - (core.from + core.to) / 2;

        const padrao = cena(base, wall.id);
        expect(espessuraDoBatente(padrao)).toBeCloseTo(total, 9);
        expect(centroDoBatente(padrao)).toBeCloseTo(0, 9);

        const nucleo = cena(base, wall.id, { frameDepthMode: 'core' });
        expect(espessuraDoBatente(nucleo)).toBeCloseTo(core.to - core.from, 9);
        expect(centroDoBatente(nucleo)).toBeCloseTo(centroNucleo, 9);
      });
    }
  }

  it('parede de uma camada: núcleo = espessura total', () => {
    for (const base of TIPOS) {
      const padrao = cenaComStore(base, 'wt_uma');
      expect(espessuraDoBatente(padrao)).toBeCloseTo(0.1, 9);
      const nucleo = cenaComStore(base, 'wt_uma', { frameDepthMode: 'core' });
      expect(espessuraDoBatente(nucleo)).toBeCloseTo(0.1, 9);
    }
  });
});

/** Cena usando o store já preparado (para o tipo de parede de uma camada criado no teste). */
function cenaComStore(base: string, wallTypeId: string, extra: Partial<OpeningType> = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertWallType', wallType: umaCamada });
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo base ausente no store: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: wallTypeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), t: p.openingTypes.ot_x! };
}
