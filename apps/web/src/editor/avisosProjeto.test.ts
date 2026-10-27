import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Project, type ValidationIssue } from '@hestia/model';
import { ESPERA_OCIOSA_MS, SETTLE_MS, agendarAvisos, avisosDoProjeto } from './avisosProjeto.ts';

/** Projeto vazio com uma parede, para que os avisos rodem sobre algum elemento. */
function projetoComParede(): Project {
  const s = new ProjectStore(createEmptyProject('Teste de avisos'));
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w_teste', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  return s.project;
}

/** Sem `requestAnimationFrame` (ambiente de teste), cada quadro é um temporizador de 16 ms. */
const QUADRO_MS = 16;
/** Tempo até a entrega: silêncio + dois quadros + janela ociosa (temporizador de 0 ms). */
const ENTREGA_MS = SETTLE_MS + QUADRO_MS * 2;

describe('agendarAvisos', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('não entrega nada antes do prazo de silêncio', () => {
    const recebido: ValidationIssue[][] = [];
    agendarAvisos(projetoComParede(), (a) => recebido.push(a));
    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(recebido).toHaveLength(0);
  });

  it('depois do silêncio ainda espera as pinturas: o primeiro quadro da abertura não é segurado', () => {
    const recebido: ValidationIssue[][] = [];
    agendarAvisos(projetoComParede(), (a) => recebido.push(a));
    vi.advanceTimersByTime(SETTLE_MS + QUADRO_MS);
    expect(recebido).toHaveLength(0);
  });

  it('entrega exatamente o resultado de avisosDoProjeto, uma vez, depois do silêncio e das pinturas', () => {
    const p = projetoComParede();
    const direto = avisosDoProjeto(p);
    const recebido: ValidationIssue[][] = [];
    agendarAvisos(p, (a) => recebido.push(a));
    vi.advanceTimersByTime(ENTREGA_MS + 1);
    expect(recebido).toHaveLength(1);
    expect(recebido[0]).toEqual(direto);
    vi.advanceTimersByTime(SETTLE_MS * 2);
    expect(recebido).toHaveLength(1);
  });

  it('cancelar a agenda impede a entrega (troca de projeto ou desmontagem)', () => {
    const recebido: ValidationIssue[][] = [];
    const cancelar = agendarAvisos(projetoComParede(), (a) => recebido.push(a));
    cancelar();
    vi.advanceTimersByTime(SETTLE_MS * 2);
    expect(recebido).toHaveLength(0);
  });

  it('cancelar entre o silêncio e a pintura também impede a entrega (o quadro pendente é cancelado)', () => {
    const recebido: ValidationIssue[][] = [];
    const cancelar = agendarAvisos(projetoComParede(), (a) => recebido.push(a));
    vi.advanceTimersByTime(SETTLE_MS);
    cancelar();
    vi.advanceTimersByTime(SETTLE_MS * 2);
    expect(recebido).toHaveLength(0);
  });

  it('com requestAnimationFrame e requestIdleCallback: entrega só na janela ociosa, depois de dois quadros', () => {
    const quadros: FrameRequestCallback[] = [];
    const ociosos: IdleRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
      quadros.push(f);
      return quadros.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('requestIdleCallback', (f: IdleRequestCallback) => {
      ociosos.push(f);
      return ociosos.length;
    });
    vi.stubGlobal('cancelIdleCallback', () => undefined);
    const recebido: ValidationIssue[][] = [];
    agendarAvisos(projetoComParede(), (a) => recebido.push(a));
    vi.advanceTimersByTime(SETTLE_MS);
    expect(quadros).toHaveLength(1);
    expect(recebido).toHaveLength(0);
    quadros[0]!({} as DOMHighResTimeStamp);
    expect(quadros).toHaveLength(2);
    expect(recebido).toHaveLength(0);
    quadros[1]!({} as DOMHighResTimeStamp);
    expect(ociosos).toHaveLength(1);
    expect(recebido).toHaveLength(0);
    ociosos[0]!({ didTimeout: false, timeRemaining: () => ESPERA_OCIOSA_MS });
    expect(recebido).toHaveLength(1);
  });
});
