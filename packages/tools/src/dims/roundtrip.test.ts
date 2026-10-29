import { describe, expect, it } from 'vitest';
import { dist, type Vec2 } from '@hestia/geom';
import {
  createEmptyProject,
  dimensionSettingsOf,
  isOpening,
  makeWall,
  OPENING_DIM_REFS,
  ProjectStore,
  WALL_DIM_REFS,
  type OpeningDimRef,
  type Project,
  type WallDimRef,
} from '@hestia/model';
import { openingDimProvider } from './providers/opening.ts';
import { wallDimProvider } from './providers/wall.ts';
import type { DimContext } from './types.ts';
import { along, ANGLES, dirOf, normalOf, ORIGIN, roundtrip, type EditableCase, type Fixture } from './roundtripSupport.ts';

function store(): ProjectStore {
  return new ProjectStore(createEmptyProject());
}

function addWall(s: ProjectStore, id: string, a: Vec2, b: Vec2): void {
  s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b }) });
}

function ctxOf(project: Project, wallRef: WallDimRef, openingRef: OpeningDimRef, overrides: DimContext['overrides'] = {}): DimContext {
  return {
    project,
    levelId: 'lv_0',
    settings: { ...dimensionSettingsOf(project), wallRef, openingRef },
    overrides,
  };
}

const restExcept = (p: Project, id: string): string => JSON.stringify(Object.values(p.elements).filter((e) => e.id !== id));

/** Parede `h` de 6 m no ângulo dado, com uma perpendicular isolada a 1 m além da ponta `b`. */
function wallAxis(angle: number, ref: WallDimRef): Fixture {
  const s = store();
  const u = dirOf(angle);
  const n = normalOf(u);
  addWall(s, 'h', ORIGIN, along(ORIGIN, u, 6));
  const c = along(ORIGIN, u, 7);
  addWall(s, 'p', along(c, n, -2), along(c, n, 2));
  const dims = () => wallDimProvider.compute(ctxOf(s.project, ref, 'frame'), { wallId: 'h' });
  return {
    store: s,
    dims,
    targetId: 'h',
    translation: true,
    ownLength: (p) => {
      const w = p.elements.h;
      return w && w.kind === 'wall' ? dist(w.a, w.b) : Number.NaN;
    },
    rest: (p) => restExcept(p, 'h'),
  };
}

/** Parede `h` de 6 m no ângulo dado, com uma paralela isolada a 1,64 m no lado +n (o caso do dono). */
function wallParallel(angle: number, ref: WallDimRef): Fixture {
  const s = store();
  const u = dirOf(angle);
  const n = normalOf(u);
  addWall(s, 'h', ORIGIN, along(ORIGIN, u, 6));
  addWall(s, 'v', along(along(ORIGIN, n, 1.64), u, -2), along(along(ORIGIN, n, 1.64), u, 8));
  const dims = () => wallDimProvider.compute(ctxOf(s.project, ref, 'frame'), { wallId: 'h' });
  return {
    store: s,
    dims,
    targetId: 'h',
    translation: true,
    ownLength: (p) => {
      const w = p.elements.h;
      return w && w.kind === 'wall' ? dist(w.a, w.b) : Number.NaN;
    },
    rest: (p) => restExcept(p, 'h'),
  };
}

/** Hospedeira de 10 m no ângulo dado, perpendiculares em 1 m e 9 m, e a esquadria `o` centrada em 5 m. */
function openingScene(kind: 'door' | 'window', angle: number, wallRef: WallDimRef, openingRef: OpeningDimRef): Fixture {
  const s = store();
  const u = dirOf(angle);
  const n = normalOf(u);
  addWall(s, 'h', ORIGIN, along(ORIGIN, u, 10));
  for (const t of [1, 9]) {
    const c = along(ORIGIN, u, t);
    addWall(s, `v${t}`, along(c, n, -2), along(c, n, 2));
  }
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'o',
      kind,
      typeId: kind === 'door' ? 'ot_p80' : 'ot_j120',
      hostId: 'h',
      offset: 5,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    },
  });
  const subject = () => {
    const found = openingDimProvider.selectionSubject!(s.project, 'o');
    if (!found) throw new Error('a esquadria da cena não foi encontrada');
    return found;
  };
  return {
    store: s,
    dims: () => openingDimProvider.compute(ctxOf(s.project, wallRef, openingRef), subject()),
    targetId: 'o',
    translation: false,
    ownLength: (p) => {
      const o = p.elements.o;
      return o && isOpening(o) ? o.offset : Number.NaN;
    },
    rest: (p) => restExcept(p, 'o'),
  };
}

const cases: EditableCase[] = [];

for (const angle of ANGLES) {
  for (const ref of WALL_DIM_REFS) {
    cases.push({
      provider: 'parede',
      variant: 'ponta até perpendicular',
      angle,
      ref: `parede=${ref}`,
      build: () => wallAxis(angle, ref),
      keys: ['wall:h:axisB'],
    });
    cases.push({
      provider: 'parede',
      variant: 'distância até paralela',
      angle,
      ref: `parede=${ref}`,
      build: () => wallParallel(angle, ref),
      keys: ['wall:h:right'],
    });
  }
}

for (const kind of ['door', 'window'] as const) {
  for (const angle of ANGLES) {
    for (const wallRef of WALL_DIM_REFS) {
      for (const openingRef of OPENING_DIM_REFS) {
        cases.push({
          provider: `esquadria (${kind === 'door' ? 'porta' : 'janela'})`,
          variant: 'os dois lados',
          angle,
          ref: `parede=${wallRef} esquadria=${openingRef}`,
          build: () => openingScene(kind, angle, wallRef, openingRef),
          keys: ['opening:o:left', 'opening:o:right'],
        });
      }
    }
  }
}

const label = '$provider — $variant — $angle° — $ref';

describe('ida e volta das cotas editáveis', () => {
  it.each(cases)(label, (c) => {
    roundtrip(c);
  });
});

describe('sanidade das cenas', () => {
  it('a cota de parede até perpendicular é editável e mede o vão esperado', () => {
    const f = wallAxis(0, 'axis');
    const dim = f.dims().find((d) => d.key === 'wall:h:axisB');
    expect(dim?.value).toBeCloseTo(1, 9);
    expect(dim?.edit).toBeTypeOf('function');
  });

  it('a cota de esquadria é editável e a porta é reconhecida', () => {
    const f = openingScene('door', 0, 'finish', 'frame');
    expect(f.dims().map((d) => d.key)).toEqual(['opening:o:left', 'opening:o:right']);
    expect(f.dims().every((d) => d.edit !== undefined)).toBe(true);
  });
});
