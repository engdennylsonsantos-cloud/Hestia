import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits } from '@hestia/model';
import type { TempDim } from '@hestia/tools';
import { resolveDimEdit, selectionDimsSuspended, suspensionAfterConversion } from './dimsActions.ts';

const base: TempDim = {
  key: 'x:1:a',
  a: { x: 0, y: 0 },
  b: { x: 1, y: 0 },
  offset: 0.2,
  value: 1,
  ends: [
    { at: { x: 0, y: 0 }, slot: 'a', kind: 'wall', current: 'axis', options: ['axis'] },
    { at: { x: 1, y: 0 }, slot: 'b', kind: 'wall', current: 'axis', options: ['axis'] },
  ],
};
const editavel: TempDim = { ...base, edit: (v) => (v > 5 ? { error: 'Sairia da parede.' } : { commands: [{ type: 'updateElements', ids: ['e'], patch: { offset: v } }] }) };
const metros = defaultUnits();

describe('resolveDimEdit', () => {
  it('texto válido em metros devolve os comandos do provedor', () => {
    expect(resolveDimEdit(editavel, '1,20', metros)).toEqual({ kind: 'done', commands: [{ type: 'updateElements', ids: ['e'], patch: { offset: 1.2 } }] });
  });

  it('respeita a unidade do projeto (sufixo e unidade configurada)', () => {
    expect(resolveDimEdit(editavel, '120cm', metros)).toMatchObject({ kind: 'done', commands: [{ patch: { offset: 1.2 } }] });
    const cm = { ...metros, length: { ...metros.length, unit: 'cm' as const } };
    expect(resolveDimEdit(editavel, '120', cm)).toMatchObject({ kind: 'done', commands: [{ patch: { offset: 1.2 } }] });
  });

  it('valor inválido não grava', () => {
    expect(resolveDimEdit(editavel, 'abc', metros)).toEqual({ kind: 'error', message: 'Medida inválida: digite uma distância, como 1,2 m.' });
    expect(resolveDimEdit(editavel, '', metros).kind).toBe('error');
  });

  it('o exemplo da medida inválida segue a unidade do projeto', () => {
    const cm = resolveUnits({ length: { unit: 'cm', decimals: 2 } });
    expect(resolveDimEdit(editavel, 'abc', cm)).toEqual({ kind: 'error', message: 'Medida inválida: digite uma distância, como 120 cm.' });
    const ftIn = resolveUnits({ length: { unit: 'ft-in', decimals: 2 } });
    const r = resolveDimEdit(editavel, 'abc', ftIn);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain(`'`);
  });

  it('erro do provedor vira alerta e nenhum comando', () => {
    expect(resolveDimEdit(editavel, '9', metros)).toEqual({ kind: 'error', message: 'Sairia da parede.' });
  });

  it('cota só de leitura recusa', () => {
    expect(resolveDimEdit(base, '1', metros).kind).toBe('error');
  });
});

describe('suspensão das cotas temporárias depois do botão "I"', () => {
  it('só suspende quando a conversão gravou algo', () => {
    expect(suspensionAfterConversion(10, 10)).toBeNull();
    expect(suspensionAfterConversion(10, 13)).toBe(13);
  });

  it('suspende na versão da conversão e volta no desfazer/alteração', () => {
    const suspended = suspensionAfterConversion(10, 13);
    expect(selectionDimsSuspended(suspended, 13)).toBe(true);
    // Desfazer (ou qualquer alteração posterior) muda a versão: as temporárias voltam.
    expect(selectionDimsSuspended(suspended, 14)).toBe(false);
    expect(selectionDimsSuspended(null, 13)).toBe(false);
  });
});
