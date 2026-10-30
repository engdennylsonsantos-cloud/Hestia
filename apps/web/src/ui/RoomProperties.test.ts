import { describe, expect, it } from 'vitest';
import type { ResolvedRoom } from '@hestia/engine';
import { roomWarning, TAG_FIELD_OPTIONS, toggleTagField } from './RoomProperties.tsx';

const base = { roomId: 'r', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 0, y: 0 }, polygon: null, area: 0, perimeter: 0, ceilingHeight: 2.8, volume: 0, floorFinish: '', wallFinish: '', ceilingFinish: '', problem: null } as ResolvedRoom;

describe('aviso do ambiente no painel de propriedades (E/G)', () => {
  it('sem aviso quando o ambiente tem circuito e é único', () => {
    expect(roomWarning({ ...base, polygon: [[]], problem: null })).toBeNull();
  });

  it('ponto fora de circuito e circuito aberto têm texto próprio', () => {
    expect(roomWarning({ ...base, problem: 'fora' })).toContain('Sem circuito fechado');
    expect(roomWarning({ ...base, problem: 'aberto' })).toContain('Circuito aberto');
  });

  it('ambiente duplicado no mesmo circuito aponta o outro', () => {
    expect(roomWarning({ ...base, polygon: [[]], duplicateOf: 'rm_2' })).toContain('rm_2');
  });
});

describe('campos da etiqueta nesta planta de área', () => {
  it('liga e desliga um campo mantendo a ordem do bloco', () => {
    expect(toggleTagField(['name', 'area'], 'number')).toEqual(['name', 'number', 'area']);
    expect(toggleTagField(['name', 'number', 'area'], 'number')).toEqual(['name', 'area']);
  });

  it('não deixa a lista de campos vazia', () => {
    expect(toggleTagField(['name'], 'name')).toEqual(['name']);
  });

  it('oferece todos os campos do modelo, na ordem de exibição', () => {
    expect(TAG_FIELD_OPTIONS.map((o) => o.field)).toEqual(['name', 'number', 'area', 'category', 'level', 'perimeter', 'volume', 'custom']);
  });
});
