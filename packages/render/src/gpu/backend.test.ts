import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assinarEstadoGpu,
  decidirEscalonamento,
  definirBackendGpu,
  definirRestauracaoGpu,
  definirTimerGpu,
  estadoGpu,
  GuardaDeRecuperacao,
  MAX_PERDAS_JANELA,
  MAX_RECRIACOES_WEBGPU,
  MAX_REINICIOS_WEBGL2,
  MAX_TENTATIVAS_RESTORE,
  ordemDeFallback,
  preferenciaDaAcao,
  proximaCamada,
  registrarPerdaGpu,
  registrarTentativaGpu,
  registrarTentativaRestauracao,
  reiniciarEstadoGpu,
  restaurarContexto,
} from './backend.ts';

describe('ordem de fallback', () => {
  it('auto tenta WebGPU, depois WebGL2 e termina na CPU', () => {
    expect(ordemDeFallback('auto')).toEqual(['webgpu', 'webgl2', 'cpu']);
  });

  it('o default do app (webgl2) não tenta WebGPU', () => {
    expect(ordemDeFallback('webgl2')).toEqual(['webgl2', 'cpu']);
  });

  it('cpu é a única camada quando pedida', () => {
    expect(ordemDeFallback('cpu')).toEqual(['cpu']);
  });

  it('desce uma camada por vez e para na CPU', () => {
    expect(proximaCamada('webgpu')).toBe('webgl2');
    expect(proximaCamada('webgl2')).toBe('cpu');
    expect(proximaCamada('cpu')).toBeNull();
  });
});

describe('restauração do contexto WebGL2 (achado S0)', () => {
  /** Contexto falso: volta depois de `voltaNaTentativa` chamadas a `restoreContext()` (0 = já estava vivo). */
  function contextoFalso(voltaNaTentativa: number, maxTentativas = 10) {
    const tentativas: number[] = [];
    const opcoes = {
      tentar: (): void => { tentativas.push(tentativas.length + 1); },
      esperarVoltar: async (): Promise<boolean> => tentativas.length >= voltaNaTentativa,
      maxTentativas,
    };
    return { opcoes, tentativas };
  }

  it('a 1ª tentativa não pega; a 2ª, um quadro depois, restaura', async () => {
    const ctx = contextoFalso(2);
    const res = await restaurarContexto(ctx.opcoes);
    expect(res).toEqual({ estado: 'restaurado', tentativas: 2 });
  });

  it('nunca tenta restaurar sem esperar antes', async () => {
    const tentar = vi.fn();
    const res = await restaurarContexto({
      tentar,
      esperarVoltar: async () => true,
    });
    // Já estava restaurado: nenhuma tentativa.
    expect(res).toEqual({ estado: 'restaurado', tentativas: 0 });
    expect(tentar).not.toHaveBeenCalled();
  });

  it('esgota no limite e não fica em laço', async () => {
    const tentar = vi.fn();
    const res = await restaurarContexto({
      tentar,
      esperarVoltar: async () => false,
      maxTentativas: 3,
    });
    expect(res).toEqual({ estado: 'esgotado', tentativas: 3 });
    expect(tentar).toHaveBeenCalledTimes(3);
  });

  it('restoreContext que lança não interrompe as próximas tentativas', async () => {
    const tentativas: number[] = [];
    const res = await restaurarContexto({
      tentar: () => {
        tentativas.push(tentativas.length + 1);
        if (tentativas.length === 1) throw new Error('contexto morto');
      },
      esperarVoltar: async () => tentativas.length >= 3,
      maxTentativas: 4,
    });
    expect(res).toEqual({ estado: 'restaurado', tentativas: 3 });
  });

  it('informa cada tentativa e usa o limite padrão', async () => {
    const vistas: number[] = [];
    const res = await restaurarContexto({
      tentar: () => {},
      esperarVoltar: async () => false,
      aoTentar: (n) => vistas.push(n),
    });
    expect(res.tentativas).toBe(MAX_TENTATIVAS_RESTORE);
    expect(vistas).toEqual(Array.from({ length: MAX_TENTATIVAS_RESTORE }, (_, i) => i + 1));
  });
});

describe('orçamento de recuperação', () => {
  it('WebGPU recria o dispositivo até o limite e depois cai para WebGL2', () => {
    const guarda = new GuardaDeRecuperacao();
    const acoes = Array.from({ length: MAX_RECRIACOES_WEBGPU + 1 }, () => decidirEscalonamento('webgpu', guarda));
    expect(acoes.slice(0, MAX_RECRIACOES_WEBGPU).every((a) => a === 'recriar-webgpu')).toBe(true);
    expect(acoes.at(-1)).toBe('cair-webgl2');
  });

  it('WebGL2 reinicia o contexto uma vez e depois cai para CPU', () => {
    const guarda = new GuardaDeRecuperacao();
    expect(decidirEscalonamento('webgl2', guarda)).toBe('reiniciar-webgl2');
    expect(decidirEscalonamento('webgl2', guarda)).toBe('cair-cpu');
    expect(MAX_REINICIOS_WEBGL2).toBe(1);
  });

  it('perdas demais na janela escalam mesmo com orçamento sobrando', () => {
    const guarda = new GuardaDeRecuperacao();
    for (let i = 0; i <= MAX_PERDAS_JANELA; i++) guarda.registrarPerda();
    expect(guarda.podeRestaurarNoLugar()).toBe(false);
    expect(guarda.podeRecriarWebgpu()).toBe(false);
    expect(decidirEscalonamento('webgpu', guarda)).toBe('cair-webgl2');
  });

  it('a janela expira e devolve o orçamento (perda isolada não condena a sessão)', () => {
    let agora = 1_000;
    const guarda = new GuardaDeRecuperacao({ agora: () => agora, janelaMs: 1_000 });
    expect(decidirEscalonamento('webgl2', guarda)).toBe('reiniciar-webgl2');
    agora += 500;
    expect(decidirEscalonamento('webgl2', guarda)).toBe('cair-cpu');
    agora += 1_000;
    expect(guarda.podeRestaurarNoLugar()).toBe(true);
    expect(decidirEscalonamento('webgl2', guarda)).toBe('reiniciar-webgl2');
  });

  it('o resumo conta perdas e recuperações', () => {
    const guarda = new GuardaDeRecuperacao();
    guarda.registrarPerda();
    decidirEscalonamento('webgpu', guarda);
    decidirEscalonamento('webgl2', guarda);
    expect(guarda.resumo).toEqual({ perdas: 1, recriacoesWebgpu: 1, reiniciosWebgl2: 1 });
  });

  it('traduz a ação na preferência de boot', () => {
    expect(preferenciaDaAcao('recriar-webgpu')).toBe('auto');
    expect(preferenciaDaAcao('cair-webgl2')).toBe('webgl2');
    expect(preferenciaDaAcao('reiniciar-webgl2')).toBe('webgl2');
    expect(preferenciaDaAcao('cair-cpu')).toBe('cpu');
  });
});

describe('estado do backend para o ?perf=1', () => {
  beforeEach(() => reiniciarEstadoGpu('webgl2'));

  it('começa limpo e guarda a preferência', () => {
    expect(estadoGpu()).toMatchObject({ atual: 'none', preferencia: 'webgl2', tentativas: [], perdas: 0, restauracao: 'nenhuma', tentativasRestauracao: 0, timer: 'sem-gpu' });
  });

  it('registra as tentativas e o motivo da última falha', () => {
    registrarTentativaGpu({ camada: 'webgpu', ok: false, motivo: 'sem GPUAdapter', ms: 12.5 });
    registrarTentativaGpu({ camada: 'webgl2', ok: true, motivo: null, ms: 40 });
    definirBackendGpu('webgl2');
    const e = estadoGpu();
    expect(e.atual).toBe('webgl2');
    expect(e.tentativas).toHaveLength(2);
    expect(e.motivo).toBe('sem GPUAdapter');
  });

  it('marca perda em curso e o resultado da recuperação', () => {
    registrarPerdaGpu('dispositivo WebGPU perdido');
    expect(estadoGpu()).toMatchObject({ perdas: 1, restauracao: 'em-curso', motivo: 'dispositivo WebGPU perdido' });
    registrarTentativaRestauracao(2);
    expect(estadoGpu().tentativasRestauracao).toBe(2);
    definirRestauracaoGpu('dispositivo');
    expect(estadoGpu().restauracao).toBe('dispositivo');
    definirTimerGpu('disponivel');
    expect(estadoGpu().timer).toBe('disponivel');
  });

  it('o snapshot é cópia: ninguém muda o estado por fora', () => {
    registrarTentativaGpu({ camada: 'webgl2', ok: true, motivo: null, ms: 1 });
    const e = estadoGpu();
    e.tentativas[0]!.ok = false;
    e.atual = 'cpu';
    expect(estadoGpu().tentativas[0]!.ok).toBe(true);
    expect(estadoGpu().atual).toBe('none');
  });

  it('avisa os ouvintes e para de avisar ao cancelar', () => {
    const ouvinte = vi.fn();
    const cancelar = assinarEstadoGpu(ouvinte);
    definirBackendGpu('webgpu');
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte.mock.calls[0]![0]).toMatchObject({ atual: 'webgpu' });
    cancelar();
    definirBackendGpu('cpu');
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('um ouvinte quebrado não impede os outros', () => {
    const bom = vi.fn();
    const cancelarQuebrado = assinarEstadoGpu(() => { throw new Error('quebrado'); });
    const cancelarBom = assinarEstadoGpu(bom);
    registrarTentativaGpu({ camada: 'webgl2', ok: true, motivo: null, ms: 1 });
    expect(bom).toHaveBeenCalled();
    cancelarQuebrado();
    cancelarBom();
  });
});
