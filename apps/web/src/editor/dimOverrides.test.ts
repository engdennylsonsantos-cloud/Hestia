import { beforeEach, describe, expect, it } from 'vitest';
import { clearDimOverrides, setDimOverride, useUi } from './state.ts';

describe('dimOverrides (referências de cota da sessão)', () => {
  beforeEach(() => {
    useUi.setState({ dimOverrides: {}, selection: [], tool: 'select' });
  });

  it('setDimOverride grava por chave e preserva as outras', () => {
    setDimOverride('opening:wallLeft', 'axis');
    setDimOverride('opening:openRight', 'casing');
    expect(useUi.getState().dimOverrides).toEqual({ 'opening:wallLeft': 'axis', 'opening:openRight': 'casing' });
    setDimOverride('opening:wallLeft', 'coreFace');
    expect(useUi.getState().dimOverrides['opening:wallLeft']).toBe('coreFace');
  });

  it('clearDimOverrides esvazia', () => {
    setDimOverride('opening:wallLeft', 'axis');
    clearDimOverrides();
    expect(useUi.getState().dimOverrides).toEqual({});
  });

  it('trocar de ferramenta ou de seleção limpa as trocas', () => {
    setDimOverride('opening:wallLeft', 'axis');
    useUi.setState({ tool: 'wall' });
    expect(useUi.getState().dimOverrides).toEqual({});
    setDimOverride('opening:wallLeft', 'axis');
    useUi.setState({ selection: ['a'] });
    expect(useUi.getState().dimOverrides).toEqual({});
  });
});
