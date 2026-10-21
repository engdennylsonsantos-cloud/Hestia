import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROOF_PROJECTION_KEY, readRoofProjection, setRoofProjection, toggleRoofProjection, useUi } from './state.ts';

/** Armazenamento de mentira com a interface que a preferência usa (getItem/setItem). */
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string): string | null => m.get(k) ?? null,
    setItem: (k: string, v: string): void => void m.set(k, String(v)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  useUi.setState({ showRoofProjection: true });
});

describe('projeção da cobertura: preferência guardada no navegador (decisão 0013 §2)', () => {
  it('sem valor gravado: ligada (padrão)', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(readRoofProjection()).toBe(true);
  });

  it('lê o valor gravado, tanto "false" quanto "true"', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [ROOF_PROJECTION_KEY]: 'false' }));
    expect(readRoofProjection()).toBe(false);
    vi.stubGlobal('localStorage', fakeStorage({ [ROOF_PROJECTION_KEY]: 'true' }));
    expect(readRoofProjection()).toBe(true);
  });

  it('valor inválido gravado: vale o padrão (ligada)', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [ROOF_PROJECTION_KEY]: 'talvez' }));
    expect(readRoofProjection()).toBe(true);
  });

  it('ao abrir a tela, o estado já sai com o valor gravado', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', fakeStorage({ [ROOF_PROJECTION_KEY]: 'false' }));
    const fresh = await import('./state.ts');
    expect(fresh.useUi.getState().showRoofProjection).toBe(false);
  });

  it('gravar: guarda "false" ou "true" e altera o estado na hora', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    setRoofProjection(false);
    expect(store.m.get(ROOF_PROJECTION_KEY)).toBe('false');
    expect(useUi.getState().showRoofProjection).toBe(false);
    expect(readRoofProjection()).toBe(false);
    setRoofProjection(true);
    expect(store.m.get(ROOF_PROJECTION_KEY)).toBe('true');
    expect(useUi.getState().showRoofProjection).toBe(true);
  });

  it('o alternador (faixa e aba Vista) inverte o estado e grava a escolha', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    setRoofProjection(true);
    toggleRoofProjection();
    expect(useUi.getState().showRoofProjection).toBe(false);
    expect(store.m.get(ROOF_PROJECTION_KEY)).toBe('false');
    toggleRoofProjection();
    expect(useUi.getState().showRoofProjection).toBe(true);
    expect(store.m.get(ROOF_PROJECTION_KEY)).toBe('true');
  });

  it('armazenamento indisponível (leitura e gravação lançam): leitura vale o padrão e a escolha vale na sessão', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    vi.stubGlobal('localStorage', broken);
    expect(readRoofProjection()).toBe(true);
    expect(() => setRoofProjection(false)).not.toThrow();
    expect(useUi.getState().showRoofProjection).toBe(false);
    expect(() => toggleRoofProjection()).not.toThrow();
    expect(useUi.getState().showRoofProjection).toBe(true);
  });

  it('ambiente sem localStorage (como o de teste): sem erro, padrão ligada', () => {
    vi.unstubAllGlobals();
    expect(readRoofProjection()).toBe(true);
    expect(() => setRoofProjection(false)).not.toThrow();
    expect(useUi.getState().showRoofProjection).toBe(false);
  });
});
