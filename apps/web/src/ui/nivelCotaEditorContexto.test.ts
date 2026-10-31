import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { decidirFechamentoCota, type ContextoCota } from './NivelCotaEditor.tsx';

/** Contexto de abertura da cota no 3D. Cada chamada cria uma referência de projeto nova, como um `load`. */
const contexto = (patch: Partial<ContextoCota> = {}): ContextoCota => ({
  view: '3d', levelId: 'lv_0', projeto: createEmptyProject(), ...patch,
});

describe('contexto da edição da cota no 3D', () => {
  it('mesma vista, nível e projeto: fecha aplicando a elevação', () => {
    const aberto = contexto();
    expect(decidirFechamentoCota(aberto, { ...aberto })).toBe('aplicar');
  });

  it('vista diferente (planta, corte ou prancha): fecha sem aplicar', () => {
    const aberto = contexto();
    expect(decidirFechamentoCota(aberto, { ...aberto, view: 'plan' })).toBe('cancelar');
    expect(decidirFechamentoCota(aberto, { ...aberto, view: 'sheet' })).toBe('cancelar');
  });

  it('nível ativo diferente: fecha sem aplicar', () => {
    const aberto = contexto();
    expect(decidirFechamentoCota(aberto, { ...aberto, levelId: 'lv_1' })).toBe('cancelar');
  });

  it('projeto diferente com os mesmos ids de nível: fecha sem aplicar (não mexe no projeto novo)', () => {
    const aberto = contexto();
    const atual = contexto();
    // Os templates reusam `lv_0`…: só a referência do documento distingue os projetos.
    expect(atual.levelId).toBe(aberto.levelId);
    expect(atual.projeto).not.toBe(aberto.projeto);
    expect(decidirFechamentoCota(aberto, atual)).toBe('cancelar');
  });
});
