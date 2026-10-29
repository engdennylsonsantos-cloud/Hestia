import { describe, expect, it } from 'vitest';
import { buildTemplate, isCeiling, isFloor, isRoof, isSlab, type Layer, type Project } from '@hestia/model';
import { ifcGeometryOf } from '../../../../apps/web/src/editor/ifcExport.ts';
import { exportIfc } from './ifcExport.ts';
import { ifcGuid } from './ifcGuid.ts';
import type { IfcGeometry, IfcPrism } from './ifcTypes.ts';

const TS = '2026-10-29T00:00:00';
const MODELS = ['house-premium', 'predio10'] as const;

/** Linhas STEP de uma classe (a classe exata, sem as variantes `*STANDARDCASE`). */
const linesOf = (text: string, type: string): string[] => text.match(new RegExp(`^#\\d+=${type}\\(.*\\);$`, 'gm')) ?? [];

/** Contagem de entidades de uma classe. */
const countOf = (text: string, type: string): number => linesOf(text, type).length;

/** IFCSLAB por PredefinedType (último atributo da entidade). */
const slabCount = (text: string, kind: string): number => linesOf(text, 'IFCSLAB').filter((l) => l.endsWith(`.${kind}.);`)).length;

/** Id STEP por GlobalId (primeiro atributo de texto de cada linha). */
function idsByGuid(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of text.matchAll(/^#(\d+)=[A-Z0-9_]+\(\s*'([^']*)'/gm)) out.set(m[2]!, Number(m[1]));
  return out;
}

/** Material associado a cada objeto: id do objeto → id do IFCMATERIALLAYERSETUSAGE que o referencia. */
function materialUsageByObject(text: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of linesOf(text, 'IFCRELASSOCIATESMATERIAL')) {
    const m = /\([^;]*,\s*\(([^)]*)\)\s*,\s*#(\d+)\s*\);$/.exec(line);
    if (!m) continue;
    const usage = Number(m[2]);
    for (const r of m[1]!.matchAll(/#(\d+)/g)) out.set(Number(r[1]), usage);
  }
  return out;
}

/** Camadas (ids de IFCMATERIALLAYER) de um IFCMATERIALLAYERSETUSAGE. */
function layerIdsOfUsage(text: string, usageId: number): number[] {
  const usage = linesOf(text, 'IFCMATERIALLAYERSETUSAGE').find((l) => l.startsWith(`#${usageId}=`));
  const setId = usage ? /\(#(\d+),/.exec(usage)?.[1] : undefined;
  if (!setId) return [];
  const set = linesOf(text, 'IFCMATERIALLAYERSET').find((l) => l.startsWith(`#${setId}=`));
  if (!set) return [];
  const inner = /^#\d+=IFCMATERIALLAYERSET\(\(([^)]*)\)/.exec(set)?.[1] ?? '';
  return [...inner.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

/** Material, espessura e nome de cada IFCMATERIALLAYER do conjunto de camadas. */
function layerDetails(text: string, usageId: number): Array<{ material: number; thickness: number; name: string }> {
  const out: Array<{ material: number; thickness: number; name: string }> = [];
  for (const layerId of layerIdsOfUsage(text, usageId)) {
    const line = linesOf(text, 'IFCMATERIALLAYER').find((l) => l.startsWith(`#${layerId}=`));
    const m = line ? /^#\d+=IFCMATERIALLAYER\(#(\d+),([\d.]+),\$,'([^']*)'/.exec(line) : null;
    if (m) out.push({ material: Number(m[1]), thickness: Number(m[2]), name: m[3]! });
  }
  return out;
}

/** Furos (IFCOPENINGELEMENT) de cada elemento hospedeiro, por IFCRELVOIDSELEMENT. */
function voidsByHost(text: string): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const line of linesOf(text, 'IFCRELVOIDSELEMENT')) {
    const refs = [...line.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    const host = refs[refs.length - 2];
    const voidId = refs[refs.length - 1];
    if (host === undefined || voidId === undefined) continue;
    out.set(host, [...(out.get(host) ?? []), voidId]);
  }
  return out;
}

/** Filhos de um IFCRELAGGREGATES cujo pai é `parent`. */
function aggregateChildren(text: string, parent: number): number[] {
  for (const line of linesOf(text, 'IFCRELAGGREGATES')) {
    const m = /,\s*#(\d+)\s*,\s*\(([^)]*)\)\s*\);$/.exec(line);
    if (!m || Number(m[1]) !== parent) continue;
    return [...m[2]!.matchAll(/#(\d+)/g)].map((x) => Number(x[1]));
  }
  return [];
}

/** Total de laços internos (furos) dos prismas de uma prancha. */
const holeCount = (prisms: readonly IfcPrism[]): number => prisms.reduce((s, pr) => s + Math.max(0, pr.polygon.length - 1), 0);

/** Camadas do tipo de cada elemento (vazio quando não há tipo). */
function layersOfElement(p: Project, id: string, kind: 'floor' | 'slab' | 'ceiling' | 'roof'): readonly Layer[] {
  const el = p.elements[id];
  if (kind === 'floor' && isFloor(el)) return p.floorTypes[el.typeId]?.layers ?? [];
  if (kind === 'slab' && isSlab(el)) return p.slabTypes[el.typeId]?.layers ?? [];
  if (kind === 'ceiling' && isCeiling(el)) return p.ceilingTypes[el.typeId]?.layers ?? [];
  if (kind === 'roof' && isRoof(el)) return p.roofTypes[el.typeId]?.layers ?? [];
  return [];
}

interface Case {
  id: (typeof MODELS)[number];
  p: Project;
  geo: IfcGeometry;
  text: string;
}

const CASES: Case[] = MODELS.map((id) => {
  const p = buildTemplate(id);
  const geo = ifcGeometryOf(p);
  return { id, p, geo, text: exportIfc(p, geo, { timestamp: TS }) };
});

const caseOf = (id: Case['id']): Case => CASES.find((c) => c.id === id)!;

describe.each(CASES)('IFC de $id — pisos, lajes, forros, telhado e escada', ({ p, geo, text }) => {
  const ids = idsByGuid(text);
  const idOf = (key: string): number => {
    const id = ids.get(ifcGuid(key));
    expect(id, `entidade ${key} ausente no IFC`).toBeDefined();
    return id!;
  };

  it('classifica cada IFCSLAB: piso .FLOOR., laje .BASESLAB., água .ROOF. e patamar .LANDING.', () => {
    const waters = geo.roofs.reduce((s, r) => s + r.planes.length, 0);
    const landings = geo.stairs.reduce((s, st) => s + st.landings.length, 0);
    expect(slabCount(text, 'FLOOR')).toBe(geo.floors.length);
    expect(slabCount(text, 'BASESLAB')).toBe(geo.slabs.length);
    expect(slabCount(text, 'ROOF')).toBe(waters);
    expect(slabCount(text, 'LANDING')).toBe(landings);
    expect(countOf(text, 'IFCSLAB')).toBe(geo.floors.length + geo.slabs.length + waters + landings);
  });

  it('não confunde piso com laje na ida e volta (FLOOR só para piso, BASESLAB só para laje)', () => {
    const floors = Object.values(p.elements).filter(isFloor).length;
    const slabs = Object.values(p.elements).filter(isSlab).length;
    // Só entram no IFC os elementos que resolvem geometria; o resto não pode virar uma classe trocada.
    expect(slabCount(text, 'FLOOR')).toBeLessThanOrEqual(floors);
    expect(slabCount(text, 'BASESLAB')).toBeLessThanOrEqual(slabs);
    expect(slabCount(text, 'FLOOR')).toBe(geo.floors.length);
    expect(slabCount(text, 'BASESLAB')).toBe(geo.slabs.length);
  });

  it('dá a cada prancha um IFCMATERIALLAYERSETUSAGE com todas as camadas do tipo', () => {
    const usage = materialUsageByObject(text);
    const plates: Array<{ key: string; id: string; kind: 'floor' | 'slab' | 'roof'; layers: readonly Layer[] }> = [
      ...geo.floors.map((f) => ({ key: `floor:${f.floorId}`, id: f.floorId, kind: 'floor' as const, layers: layersOfElement(p, f.floorId, 'floor') })),
      ...geo.slabs.map((s) => ({ key: `slab:${s.slabId}`, id: s.slabId, kind: 'slab' as const, layers: layersOfElement(p, s.slabId, 'slab') })),
      ...geo.roofs.flatMap((r) =>
        r.planes.map((_, i) => ({ key: `roofslab:${r.roofId}:${i}`, id: r.roofId, kind: 'roof' as const, layers: layersOfElement(p, r.roofId, 'roof') })),
      ),
    ];
    expect(plates.length).toBeGreaterThan(0);
    for (const plate of plates) {
      const entity = idOf(plate.key);
      const usageId = usage.get(entity);
      expect(usageId, `${plate.key} sem IFCRELASSOCIATESMATERIAL`).toBeDefined();
      const line = linesOf(text, 'IFCMATERIALLAYERSETUSAGE').find((l) => l.startsWith(`#${usageId}=`))!;
      // Sentido das camadas: do topo para baixo, com deslocamento zero na linha de referência.
      expect(line, plate.key).toMatch(/\(#\d+,\.AXIS3\.,\.NEGATIVE\.,0\.000000,\$\);$/);
      const positive = plate.layers.filter((l) => l.thickness > 0);
      const details = layerDetails(text, usageId!);
      expect(details, `${plate.key}: camadas`).toHaveLength(positive.length);
      expect(details.map((d) => d.thickness)).toEqual(positive.map((l) => Number(l.thickness.toFixed(6))));
      for (const d of details) {
        expect(d.material).toBeGreaterThan(0);
        expect(d.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('sai cada furo/vão como IFCOPENINGELEMENT + IFCRELVOIDSELEMENT, no elemento hospedeiro', () => {
    const platePrisms: IfcPrism[] = [
      ...geo.floors.flatMap((f) => f.prisms),
      ...geo.slabs.flatMap((s) => s.prisms),
      ...geo.roofs.flatMap((r) => r.planes),
      ...geo.stairs.flatMap((s) => s.landings),
    ];
    const holes = platePrisms.reduce((s, pr) => s + Math.max(0, pr.polygon.length - 1), 0);
    const expectedVoids = geo.openings.length + holes;
    expect(countOf(text, 'IFCOPENINGELEMENT')).toBe(expectedVoids);
    expect(countOf(text, 'IFCRELVOIDSELEMENT')).toBe(expectedVoids);

    const voids = voidsByHost(text);
    for (const s of geo.slabs) {
      const host = idOf(`slab:${s.slabId}`);
      expect(voids.get(host)?.length ?? 0, `furos da laje ${s.slabId}`).toBe(holeCount(s.prisms));
    }
    for (const f of geo.floors) {
      const host = idOf(`floor:${f.floorId}`);
      expect(voids.get(host)?.length ?? 0, `furos do piso ${f.floorId}`).toBe(holeCount(f.prisms));
    }
  });

  it('telhado: um IFCROOF com o tipo da forma e uma IFCSLAB ROOF por água, agregada', () => {
    expect(countOf(text, 'IFCROOF')).toBe(geo.roofs.length);
    for (const r of geo.roofs) {
      const roof = idOf(`roof:${r.roofId}`);
      const el = p.elements[r.roofId];
      const kind = el && isRoof(el) ? el.shape : undefined;
      const expected = kind === 'shed' ? 'SHED_ROOF' : kind === 'gable' ? 'GABLE_ROOF' : kind === 'hip' ? 'HIP_ROOF' : 'FREEFORM';
      const line = linesOf(text, 'IFCROOF').find((l) => l.startsWith(`#${roof}=`))!;
      expect(line.endsWith(`.${expected}.);`), `IFCROOF ${r.roofId}: ${line}`).toBe(true);
      const waters = r.planes.map((_, i) => idOf(`roofslab:${r.roofId}:${i}`));
      expect(aggregateChildren(text, roof), `águas de ${r.roofId}`).toEqual(waters);
      expect(waters.length).toBe(r.planes.length);
    }
  });

  it('escada: um IFCSTAIRFLIGHT por lance, agregado ao IFCSTAIR, com risers, treads, espelho e piso', () => {
    expect(countOf(text, 'IFCSTAIR')).toBe(geo.stairs.length);
    const flights = geo.stairs.reduce((s, st) => s + st.flights.length, 0);
    expect(countOf(text, 'IFCSTAIRFLIGHT')).toBe(flights);
    for (const s of geo.stairs) {
      const stair = idOf(`stair:${s.stairId}`);
      const line = linesOf(text, 'IFCSTAIR').find((l) => l.startsWith(`#${stair}=`))!;
      expect(line.endsWith(`.${s.spiral ? 'SPIRAL_STAIR' : 'STRAIGHT_RUN_STAIR'}.);`), `IFCSTAIR ${s.stairId}`).toBe(true);
      const children = aggregateChildren(text, stair);
      expect(children, `lances de ${s.stairId}`).toEqual(s.flights.map((f) => idOf(`flight:${s.stairId}:${f.componentIndex}`)));
      for (const f of s.flights) {
        const flightId = idOf(`flight:${s.stairId}:${f.componentIndex}`);
        const entity = linesOf(text, 'IFCSTAIRFLIGHT').find((l) => l.startsWith(`#${flightId}=`))!;
        // Atributos finais: NumberOfRiser, NumberOfTreads, RiserHeight, TreadLength, PredefinedType.
        const m = /,(\d+),(\d+),([\d.]+),([\d.]+),\.(STRAIGHT|SPIRAL)\.\);$/.exec(entity);
        expect(m, `atributos do lance de ${s.stairId}`).not.toBeNull();
        expect(Number(m![1]), `risers de ${s.stairId}`).toBe(f.risers);
        expect(Number(m![2]), `treads de ${s.stairId}`).toBe(f.treads);
        expect(Number(m![3])).toBeCloseTo(s.riserHeight, 5);
        expect(Number(m![4]), `TreadLength de ${s.stairId}`).toBeGreaterThan(0);
        expect(m![5]).toBe(s.spiral ? 'SPIRAL' : 'STRAIGHT');
        expect(f.risers).toBeGreaterThan(0);
        expect(f.treads).toBeGreaterThan(0);
      }
    }
  });
});

describe('predio10 — regressão do round-trip piso/laje', () => {
  const predio = caseOf('predio10');

  it('exporta 40 pisos .FLOOR. e 10 lajes .BASESLAB. (antes: 50 e 0)', () => {
    expect(slabCount(predio.text, 'FLOOR')).toBe(40);
    expect(slabCount(predio.text, 'BASESLAB')).toBe(10);
    expect(slabCount(predio.text, 'ROOF')).toBe(0);
    expect(slabCount(predio.text, 'LANDING')).toBe(0);
  });

  it('tem 10 escadas de um lance cada, todas com piso e espelho medidos', () => {
    expect(countOf(predio.text, 'IFCSTAIR')).toBe(10);
    expect(countOf(predio.text, 'IFCSTAIRFLIGHT')).toBe(10);
    for (const line of linesOf(predio.text, 'IFCSTAIRFLIGHT')) {
      const m = /,(\d+),(\d+),([\d.]+),([\d.]+),\.(STRAIGHT|SPIRAL)\.\);$/.exec(line);
      expect(m, line).not.toBeNull();
      expect(Number(m![1])).toBe(17);
      expect(Number(m![2])).toBe(17);
      expect(Number(m![3])).toBeGreaterThan(0);
      expect(Number(m![4])).toBeGreaterThan(0);
    }
  });
});

describe('house-premium — telhado de quatro águas', () => {
  const casa = caseOf('house-premium');

  it('tem um IFCROOF .HIP_ROOF. com quatro IFCSLAB .ROOF., uma por água', () => {
    expect(countOf(casa.text, 'IFCROOF')).toBe(1);
    expect(slabCount(casa.text, 'ROOF')).toBe(4);
    expect(casa.geo.roofs[0]?.planes).toHaveLength(4);
    const roof = casa.text.match(/^#\d+=IFCROOF\(.*\);$/m)?.[0];
    expect(roof).toBeDefined();
    expect(roof!).toContain('.HIP_ROOF.');
  });
});

describe('forro (opcional no contrato de geometria)', () => {
  it('sai como IFCCOVERING .CEILING. com camadas e furos, no pavimento', () => {
    const p = buildTemplate('house-premium');
    const geo = ifcGeometryOf(p);
    const levelId = p.levels[0]!.id;
    const points = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const ceiling = {
      id: 'c_teste',
      kind: 'ceiling' as const,
      typeId: Object.keys(p.ceilingTypes)[0]!,
      levelId,
      boundary: points,
      holes: [],
      heightOffset: 2.6,
      mark: '',
      comments: '',
      order: p.nextOrder,
    };
    const prism: IfcPrism = {
      polygon: [points, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }]],
      top: { a: 0, b: 0, c: 2.6 },
      bottom: { a: 0, b: 0, c: 2.5 },
    };
    const withCeiling = {
      ...p,
      elements: { ...p.elements, c_teste: ceiling },
    } as Project;
    const out = exportIfc(withCeiling, { ...geo, ceilings: [{ ceilingId: 'c_teste', prisms: [prism] }] } as IfcGeometry, { timestamp: TS });
    const base = exportIfc(p, geo, { timestamp: TS });
    expect(countOf(out, 'IFCCOVERING')).toBe(1);
    expect(out.match(/^#\d+=IFCCOVERING\(.*\);$/m)?.[0]).toContain('.CEILING.');
    // O furo do forro vira vão (além dos vãos das paredes e dos furos das pranchas) e o forro recebe as camadas do tipo.
    expect(countOf(out, 'IFCOPENINGELEMENT')).toBe(countOf(base, 'IFCOPENINGELEMENT') + 1);
    expect(countOf(out, 'IFCRELVOIDSELEMENT')).toBe(countOf(base, 'IFCRELVOIDSELEMENT') + 1);
    const ids = idsByGuid(out);
    const covering = ids.get(ifcGuid('ceiling:c_teste'));
    expect(covering).toBeDefined();
    const voids = voidsByHost(out);
    expect(voids.get(covering!)?.length).toBe(1);
    const usage = materialUsageByObject(out);
    expect(usage.get(covering!)).toBeDefined();
  });
});
