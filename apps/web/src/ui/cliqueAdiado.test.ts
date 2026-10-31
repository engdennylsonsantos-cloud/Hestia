import { describe, expect, it } from 'vitest';
import { MAX_TENTATIVAS_VISTA, cliqueAdiadoInicial, decidirCliqueAdiado, type EstadoCliqueAdiado } from './cliqueAdiado.ts';

/** Um quadro de espera: o rAF pergunta se a vista já existe. */
function quadro(estado: EstadoCliqueAdiado, vistaPronta: boolean): { estado: EstadoCliqueAdiado; acao: string } {
  return decidirCliqueAdiado(estado, { tipo: 'quadro', vistaPronta });
}

describe('down adiado até a vista existir', () => {
  it('adia e entrega uma única vez quando a vista fica pronta', () => {
    let r = quadro(cliqueAdiadoInicial(), false);
    expect(r.acao).toBe('nenhuma');
    r = quadro(r.estado, false);
    expect(r.acao).toBe('nenhuma');
    expect(r.estado.tentativas).toBe(2);
    r = quadro(r.estado, true);
    expect(r.acao).toBe('entregar-down');
    expect(r.estado.fase).toBe('entregue');
    // Outro quadro, ou uma solta atrasada, não entrega de novo.
    expect(quadro(r.estado, true).acao).toBe('nenhuma');
    expect(decidirCliqueAdiado(r.estado, { tipo: 'soltar' }).acao).toBe('nenhuma');
  });

  it('não entrega duas vezes mesmo com quadros prontos repetidos', () => {
    const primeiro = quadro(cliqueAdiadoInicial(), true);
    expect(primeiro.acao).toBe('entregar-down');
    let estado = primeiro.estado;
    for (let i = 0; i < 5; i++) {
      const r = quadro(estado, true);
      expect(r.acao).toBe('nenhuma');
      estado = r.estado;
    }
  });

  it('up antes da vista não gera click fantasma: fecha down → up → click em ordem', () => {
    const soltou = decidirCliqueAdiado(cliqueAdiadoInicial(), { tipo: 'soltar' });
    expect(soltou.acao).toBe('nenhuma');
    expect(soltou.estado.soltou).toBe(true);
    expect(soltou.estado.fase).toBe('armado');
    const entrega = quadro(soltou.estado, true);
    expect(entrega.acao).toBe('entregar-solto');
    expect(quadro(entrega.estado, true).acao).toBe('nenhuma');
  });

  it('se o gesto for cancelado antes da vista, o up registrado é descartado', () => {
    const soltou = decidirCliqueAdiado(cliqueAdiadoInicial(), { tipo: 'soltar' });
    const cancelou = decidirCliqueAdiado(soltou.estado, { tipo: 'cancelar' });
    expect(cancelou.acao).toBe('abandonar');
    expect(quadro(cancelou.estado, true).acao).toBe('nenhuma');
  });

  it('desiste no limite de tentativas, sem entregar nada depois', () => {
    let estado = cliqueAdiadoInicial();
    for (let i = 1; i < MAX_TENTATIVAS_VISTA; i++) {
      const r = quadro(estado, false);
      expect(r.acao).toBe('nenhuma');
      estado = r.estado;
    }
    const limite = quadro(estado, false);
    expect(limite.acao).toBe('abandonar');
    expect(limite.estado.fase).toBe('desistiu');
    expect(quadro(limite.estado, true).acao).toBe('nenhuma');
    expect(decidirCliqueAdiado(limite.estado, { tipo: 'soltar' }).acao).toBe('nenhuma');
  });
});
