import { describe, expect, it } from 'vitest';
import {
  buildTemplate,
  DEFAULT_AREA_GRAPHICS,
  DEFAULT_TAG_FIELDS,
  emptyTitleBlock,
  ProjectStore,
  type AreaPlan,
  type Project,
  type Sheet,
} from '@hestia/model';
import { buildDxfBatch, dxfBatchTargetsOf, dxfBatchZipName, dxfSanitizeName } from './dxfBatch.ts';
import type { DxfBatchOptions, DxfBatchRenderers } from './dxfBatch.types.ts';

/**
 * Lote DXF: a lista de documentos do projeto, os nomes sanitizados (com colisão), o manifest e os motivos de exclusão.
 * Os renderizadores são falsos de propósito: o lote não desenha, só organiza os arquivos que cada um devolve.
 */

/** Projeto do teste: 2 níveis, 1 planta de área, 1 corte, 1 elevação e 1 prancha. */
function projeto(): Project {
  const store = new ProjectStore(buildTemplate('house2'));
  const levelId = store.project.levels[0]!.id;
  store.exec({ type: 'addView', view: { id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: -1, y: -2 }, b: { x: 12, y: -2 }, depth: 30 } });
  store.exec({ type: 'addView', view: { id: 'elev_n', name: 'Elevação Norte', kind: 'elevation', a: { x: -1, y: -2 }, b: { x: 12, y: -2 }, depth: 30 } });
  const area: AreaPlan = {
    id: 'ap1',
    name: 'Planta de área',
    levelId,
    scale: 50,
    graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
    tags: [],
  };
  store.exec({ type: 'addAreaPlan', plan: area });
  const prancha: Sheet = {
    id: 'sh1',
    number: 'PR-01',
    name: 'Planta Térreo',
    size: 'A2',
    orientation: 'landscape',
    margin: 10,
    titleBlock: emptyTitleBlock(),
    viewports: [],
  };
  store.exec({ type: 'addSheet', sheet: prancha });
  return store.project;
}

const opcoes = (extra: Partial<DxfBatchOptions> = {}): DxfBatchOptions => ({
  units: 'mm',
  showRoofProjection: true,
  prefix: 'Casa',
  pattern: '{tipo}-{nome}',
  ...extra,
});

/** Renderizadores falsos; `chamadas` registra a ordem (plan:…, area:…, section:…, sheet:…). */
function renderizadores(chamadas?: string[]): DxfBatchRenderers {
  const registrar = (rotulo: string): string => {
    chamadas?.push(rotulo);
    return '0\r\nEOF\r\n';
  };
  return {
    plan: (_p, levelId) => registrar(`plan:${levelId}`),
    area: (_p, planId) => registrar(`area:${planId}`),
    section: (_p, viewId) => registrar(`section:${viewId}`),
    sheet: (_p, sheetId) => registrar(`sheet:${sheetId}`),
  };
}

const TODOS = ['plan:lv_0', 'plan:lv_1', 'area:ap1', 'section:corte_a', 'section:elev_n', 'sheet:sh1'];

describe('dxfBatchTargetsOf', () => {
  it('lista plantas, áreas, cortes/elevações e pranchas na ordem, com as keys e os grupos', () => {
    const alvos = dxfBatchTargetsOf(projeto());
    expect(alvos.map((t) => t.key)).toEqual(TODOS);
    expect(alvos.map((t) => t.group)).toEqual(['plantas', 'plantas', 'areas', 'cortes', 'cortes', 'pranchas']);
    expect(alvos[0]!.label).toBe('Térreo');
    expect(alvos[1]!.label).toBe('Pavimento 2');
    expect(alvos[2]!.label).toBe('Planta de área');
    expect(alvos[3]).toMatchObject({ label: 'Corte A', elevation: false });
    expect(alvos[4]).toMatchObject({ label: 'Elevação Norte', elevation: true });
    expect(alvos[5]!.label).toBe('PR-01 Planta Térreo');
  });
});

describe('nome do arquivo', () => {
  it('{tipo}-{nome} gera a pasta e o nome com o acento em ASCII', () => {
    const r = buildDxfBatch(projeto(), ['plan:lv_0'], opcoes(), renderizadores());
    expect(r.files.map((f) => f.path)).toContain('PLANTAS/PLANTA-Terreo.dxf');
  });

  it('acento vira ASCII, espaço vira - e nome vazio cai em sem-nome', () => {
    expect(dxfSanitizeName('Elevação Norte')).toBe('Elevacao-Norte');
    expect(dxfSanitizeName('  ')).toBe('sem-nome');
  });

  it('colisão de caminho ganha -2 antes de .dxf', () => {
    const r = buildDxfBatch(projeto(), ['plan:lv_0', 'plan:lv_1'], opcoes({ pattern: 'planta' }), renderizadores());
    expect(r.files.map((f) => f.path)).toEqual(['PLANTAS/planta.dxf', 'PLANTAS/planta-2.dxf', 'manifest.csv', 'LEIA-ME.txt']);
  });

  it('o ZIP leva o prefixo sanitizado e a data local', () => {
    expect(dxfBatchZipName(projeto(), new Date(2026, 9, 30))).toBe('Casa-terrea-2-quartos-DXF-2026-10-30.zip');
  });
});

describe('buildDxfBatch', () => {
  it('chama os renderizadores na ordem dos alvos e devolve o manifest com uma linha por arquivo', () => {
    const chamadas: string[] = [];
    const r = buildDxfBatch(projeto(), TODOS, opcoes(), renderizadores(chamadas));
    expect(chamadas).toEqual(TODOS);

    const linhas = r.manifest.split(/\r?\n/).filter((l) => l !== '');
    expect(linhas[0]).toBe('arquivo;tipo;nome;nivel;escala;prancha');
    expect(linhas).toHaveLength(TODOS.length + 1);
    expect(r.manifest.endsWith('\r\n')).toBe(true);

    const caminhos = r.files.map((f) => f.path);
    expect(caminhos).toContain('PLANTAS/PLANTA-Terreo.dxf');
    expect(caminhos).toContain('AREAS/AREA-Planta-de-area.dxf');
    expect(caminhos).toContain('CORTES/CORTE-Corte-A.dxf');
    expect(caminhos).toContain('ELEVACOES/ELEVACAO-Elevacao-Norte.dxf');
    expect(caminhos).toContain('PRANCHAS/PRANCHA-PR-01-Planta-Terreo.dxf');
    expect(caminhos).toContain('manifest.csv');
    expect(caminhos).toContain('LEIA-ME.txt');

    // Planta usa a escala da vista do nível; a prancha não tem escala de desenho.
    expect(linhas[1]).toContain('PLANTAS/PLANTA-Terreo.dxf;PLANTA;Térreo;Térreo;1:');
    expect(linhas[TODOS.length]).toContain(';PRANCHA;PR-01 Planta Térreo;;;PR-01 Planta Térreo');

    const leiaMe = r.files.find((f) => f.path === 'LEIA-ME.txt')!.data;
    expect(leiaMe).toContain('R2000 (AC1015)');
    expect(leiaMe).toContain('como plotadas');
  });

  it('renderizador que lança entra em skipped com o motivo e o lote continua', () => {
    const r = buildDxfBatch(projeto(), ['plan:lv_0'], opcoes(), {
      ...renderizadores(),
      plan: () => {
        throw new Error('sem geometria');
      },
    });
    expect(r.skipped).toEqual([{ key: 'plan:lv_0', label: 'Térreo', reason: 'sem geometria' }]);
    expect(r.files.map((f) => f.path)).toEqual(['manifest.csv', 'LEIA-ME.txt']);
    expect(r.manifest.split(/\r?\n/).filter((l) => l !== '')).toHaveLength(1);
  });

  it('prancha sem renderizador entra em skipped', () => {
    const semPrancha: DxfBatchRenderers = {
      plan: () => '0\r\nEOF\r\n',
      area: () => '0\r\nEOF\r\n',
      section: () => '0\r\nEOF\r\n',
    };
    const r = buildDxfBatch(projeto(), ['sheet:sh1'], opcoes(), semPrancha);
    expect(r.skipped).toEqual([{ key: 'sheet:sh1', label: 'PR-01 Planta Térreo', reason: 'prancha sem renderizador' }]);
    expect(r.files.map((f) => f.path)).toEqual(['manifest.csv', 'LEIA-ME.txt']);
  });

  it('alvo marcado que não existe mais no projeto entra em skipped', () => {
    const r = buildDxfBatch(projeto(), ['plan:lv_0', 'plan:apagado'], opcoes(), renderizadores());
    expect(r.skipped).toEqual([{ key: 'plan:apagado', label: 'plan:apagado', reason: 'alvo inexistente' }]);
    expect(r.files.map((f) => f.path)).toContain('PLANTAS/PLANTA-Terreo.dxf');
  });
});
