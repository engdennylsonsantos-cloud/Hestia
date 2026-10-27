import { describe, expect, it } from 'vitest';
import {
  OPENING_FAMILIES,
  ProjectStore,
  createEmptyProject,
  makeWall,
  openingFormFields,
  openingFamilyOf,
  type Opening,
  type OpeningFamilyId,
  type OpeningType,
} from '@hestia/model';
import { buildOpeningModel, frameOfWall, openingGeometry } from '@hestia/engine';
import { alternarAcabamento, alternarSidelight, alternarTransom, newOpeningTypeFromFamily } from '../openingTypeForm.ts';
import {
  setOpeningReveal,
  setOpeningThreshold,
  withOpeningField,
} from './openingTypeFields.ts';

const modelo = (t: OpeningType): string => {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertOpeningType', openingType: t });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: t.id, hostId: 'w', offset: 4, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return JSON.stringify(buildOpeningModel(p, o, openingGeometry(p, o, f), f));
};

/** Valor não padrão para cada campo (o que o diálogo faria ao mexer no controle). */
function naoPadrao(t: OpeningType, field: string): OpeningType {
  switch (field) {
    case 'leafStyle':
      return withOpeningField(t, 'leafStyle', 'panel', 'flush');
    case 'glassRatio':
      return withOpeningField(t, 'glassRatio', 0.75, 0.5);
    case 'handle':
      return withOpeningField(t, 'handle', 'knob', t.handle ?? 'none');
    case 'hinges':
      return withOpeningField(t, 'hinges', 4, 3);
    case 'angle':
      return withOpeningField(withOpeningField(t, 'angle2d', 45, 90), 'angle3d', 45, 90);
    case 'transom':
      return alternarTransom(t, true);
    case 'sidelights':
      return alternarSidelight(t, 'left', true);
    case 'frame':
      return { ...withOpeningField(t, 'frameStyle', 'simple', 'rebate'), frameWidth: 0.08 };
    case 'reveal':
      return setOpeningReveal(t, { depth: 0.05, anchor: 'core' });
    case 'glassKind':
      return withOpeningField(t, 'glassKind', 'tempered', 'clear');
    case 'grid':
      return withOpeningField(t, 'grid', { cols: 2, rows: 2 }, { cols: 1, rows: 1 });
    case 'tiltAxis':
      return withOpeningField(t, 'tiltAxis', 0.3, 0.5);
    case 'threshold':
      return setOpeningThreshold(t, true, 'mat_ceramica');
    case 'casing':
      return alternarAcabamento(t, 'casing', true);
    case 'sillBoard':
      return { ...t, sillBoard: { projection: 0.04, thickness: 0.03 } };
    case 'lintel':
      return { ...t, lintel: { over: 0.2, height: 0.15 } };
    case 'sillBeam':
      return { ...t, sillBeam: { over: 0.2, height: 0.15 } };
    default:
      return t;
  }
}

/**
 * Campos já ligados ao modelo fechado. Os demais (glassRatio, hinges, angle, reveal, glassKind, threshold e os
 * estilos de folha/maçaneta que o construtor da família ainda não lê) ficam em `it.todo` até a tarefa BRM.
 */
function implementadoNoMotor(family: OpeningFamilyId, field: string): boolean {
  switch (field) {
    case 'frame':
    case 'casing':
    case 'lintel':
    case 'sillBeam':
    case 'sillBoard':
    case 'transom':
    case 'sidelights':
      return true;
    case 'tiltAxis':
      return family === 'window_tilt';
    case 'grid':
      return family.startsWith('window_');
    case 'handle':
      return family.startsWith('door_') && family !== 'door_bifold' && family !== 'door_pocket';
    case 'leafStyle':
      return family === 'door_swing' || family === 'door_double' || family === 'door_pivot' || family === 'door_sliding';
    default:
      return false;
  }
}

const pendentes: string[] = [];

describe('auditoria: todo campo visível muda o modelo (ou fica registrado como pendente)', () => {
  for (const family of OPENING_FAMILIES) {
    for (const field of openingFormFields(family.id)) {
      if (!implementadoNoMotor(family.id, field)) {
        pendentes.push(`${family.id} × ${field}`);
        continue;
      }
      it(`${family.id} × ${field}`, () => {
        const base = newOpeningTypeFromFamily(family);
        const mudado = naoPadrao(base, field);
        expect(openingFamilyOf(mudado)?.id).toBe(family.id);
        expect(modelo(base), `${family.id} × ${field}`).not.toBe(modelo(mudado));
      });
    }
  }

  it('a lista de pendentes fica explícita no relatório e coberta por it.todo', () => {
    expect(pendentes.length).toBeGreaterThan(0);
  });

  it.todo(`aguardando BRM (campos no tipo, ainda sem efeito no modelo fechado): ${pendentes.join(', ')}`);
});
