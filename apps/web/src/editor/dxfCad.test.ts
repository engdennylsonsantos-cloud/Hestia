import { describe, expect, it } from 'vitest';
import { planRamp } from '@hestia/engine';
import { dxfProblemsR12 } from '@hestia/io';
import {
  buildTemplate,
  createEmptyProject,
  DEFAULT_AREA_GRAPHICS,
  DEFAULT_TAG_FIELDS,
  makeLevel,
  makeRamp,
  makeRoom,
  ProjectStore,
  type AreaPlan,
  type Generic,
  type Project,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { areaPlanDxf, planDxf, sectionDxf } from './dxfExport.ts';

/**
 * DXF real, como sai do app, conferido pelo verificador estrutural R12 (`dxfProblemsR12`). O AutoCAD 2025 descartava os
 * três tipos de arquivo: "Unknown group 370 for table" na planta e no corte, "DXF read error" na planta de área (AC1015
 * declarado sem a estrutura do R2000).
 */

const rampType = createEmptyProject().rampTypes.rmt_nbr9050!;

/** Projeto completo: ambiente com acentos, cota, texto livre, rampa, objeto importado, corte e planta de área. */
function rico(template: 'house2' | 'house-premium'): Project {
  const store = new ProjectStore(buildTemplate(template));
  const levelId = store.project.levels[0]!.id;
  store.exec({ type: 'addRoom', room: makeRoom({ id: 'r_acento', levelId, name: 'Cozinha açaí ção', number: '101', point: { x: 3, y: 3 } }) });
  store.exec({ type: 'addDimension', levelId, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1, text: 'Vão útil 3,60 m²' } });
  store.exec({ type: 'addText', levelId, text: { id: 't1', at: { x: 2, y: 2 }, text: 'Observação: pé-direito', height: 2.5, rotation: 90 } });

  const plan = planRamp({ start: { x: 20, y: 0 }, dir: { x: 0, y: 1 }, H: 0.8, type: rampType, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const components: Array<StairRun | StairLanding> = plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));
  store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_rampa_topo', name: 'Topo da rampa', elevation: 0.8 }) });
  store.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: rampType.id, levelId, topLevelId: 'lv_rampa_topo', components, shape: 'straight', inputMode: 'slope', slopeTarget: 1 / 12 }) });

  const importado: Generic = {
    id: 'gn_a',
    kind: 'generic',
    levelId,
    name: 'viga',
    sourceClass: 'IFCBEAM',
    mesh: { positions: [], indices: [] },
    outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
    order: 1,
  };

  store.exec({ type: 'addView', view: { id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: -1, y: -2 }, b: { x: 12, y: -2 }, depth: 30 } });
  const area: AreaPlan = {
    id: 'ap1',
    name: 'Planta de área',
    levelId,
    scale: 50,
    graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
    tags: [],
  };
  store.exec({ type: 'addAreaPlan', plan: area });
  store.exec({
    type: 'updateAreaPlan',
    id: 'ap1',
    patch: {
      annotations: {
        dimensions: [{ id: 'da', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1, precision: 2 }],
        texts: [{ id: 'ta', at: { x: 1, y: 1 }, text: 'Observação', height: 2.5, rotation: 0 }],
        detailLines: [{ id: 'dl1', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }],
        detailRegions: [],
        tags: [],
      },
    },
  });
  // Não há comando para objeto importado (vem do IFC): entra direto em `elements`, num clone, como em dxfGeneric.test.
  const q = structuredClone(store.project);
  q.elements[importado.id] = importado;
  return q;
}

/** Os arquivos que o app entrega: uma planta por nível, o corte e a planta de área. */
function arquivos(p: Project): Array<[string, string]> {
  return [...p.levels.map((l): [string, string] => [`planta ${l.id}`, planDxf(p, l.id)]), ['corte', sectionDxf(p, 'corte_a')], ['planta de área', areaPlanDxf(p, 'ap1')]];
}

describe.each(['house2', 'house-premium'] as const)('DXF do template %s é R12 estrito', (template) => {
  const p = rico(template);

  it('planta, corte e planta de área passam no verificador, sem 370 nem BLOCKS ausente', () => {
    for (const [nome, text] of arquivos(p)) {
      expect(dxfProblemsR12(text), nome).toEqual([]);
      expect(text, nome).not.toContain('\r\n370\r\n');
    }
  });

  it('os três tipos declaram AC1009, têm uma só seção BLOCKS e terminam em EOF com quebra de linha', () => {
    for (const [nome, text] of arquivos(p)) {
      expect(text, nome).toContain('9\r\n$ACADVER\r\n1\r\nAC1009\r\n');
      expect(text.match(/2\r\nBLOCKS\r\n/g), nome).toHaveLength(1);
      expect(text.endsWith('0\r\nEOF\r\n'), nome).toBe(true);
    }
  });

  it('texto acentuado sai escapado (\\U+XXXX) na planta e na planta de área, sem byte não ASCII', () => {
    const nivel = p.levels[0]!.id;
    const planta = planDxf(p, nivel);
    const area = areaPlanDxf(p, 'ap1');
    expect(planta).toContain('Cozinha a\\U+00E7a\\U+00ED \\U+00E7\\U+00E3o');
    expect(area).toContain('Cozinha a\\U+00E7a\\U+00ED \\U+00E7\\U+00E3o');
    expect(planta).toContain('Observa\\U+00E7\\U+00E3o: p\\U+00E9-direito');
    expect(planta).toContain('V\\U+00E3o \\U+00FAtil 3,60 m\\U+00B2');
    for (const [nome, text] of arquivos(p)) expect(/[^\x20-\x7e\r\n]/.test(text), nome).toBe(false);
  });

  it('cotas, texto livre, rampa e objeto importado continuam no arquivo', () => {
    const planta = planDxf(p, p.levels[0]!.id);
    expect(planta).toContain('2\r\nCOTAS\r\n');
    expect(planta).toContain('2\r\nTEXTOS\r\n');
    expect(planta).toContain('2\r\nRAMPA\r\n');
    expect(planta).toContain('8\r\nIMPORTADO\r\n');
  });
});

describe('planta de área em R12', () => {
  it('traços e textos saem como LINE e TEXT nas camadas AMBIENTES*, com as cotas e textos das anotações', () => {
    const text = areaPlanDxf(rico('house2'), 'ap1');
    expect(text).toContain('8\r\nAMBIENTES_TEXTO\r\n');
    expect(text).toContain('0\r\nLINE\r\n');
    expect(text).toContain('0\r\nTEXT\r\n');
    expect(text).toContain('Observa\\U+00E7\\U+00E3o');
    expect(text).toContain('4,00 m');
    expect(dxfProblemsR12(text)).toEqual([]);
  });
});
