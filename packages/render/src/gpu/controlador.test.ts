import { describe, expect, it } from 'vitest';
import { GuardaDeRecuperacao } from './backend.ts';
import { planejarRecuperacao } from './controlador.ts';
import { mensagem } from './contexto.ts';

describe('mensagem de falha da GPU', () => {
  it('usa a mensagem do erro, limita o tamanho e tem um texto padrão', () => {
    expect(mensagem(new Error('perda de contexto'))).toBe('perda de contexto');
    expect(mensagem('texto')).toBe('texto');
    expect(mensagem(undefined)).toBe('falha desconhecida');
    expect(mensagem(new Error('x'.repeat(300)))).toHaveLength(160);
  });
});

describe('planejamento da recuperação', () => {
  it('WebGPU com orçamento: recria em auto, com a tentativa no status', () => {
    const p = planejarRecuperacao('webgpu', 'dispositivo perdido', new GuardaDeRecuperacao({ agora: () => 0 }));
    expect(p.prefer).toBe('auto');
    expect(p.status).toContain('dispositivo perdido');
    expect(p.status).toContain('Recriando WebGPU');
    expect(p.status).toContain('tentativa 1');
  });

  it('WebGL2 com orçamento: reinicia no mesmo backend', () => {
    const p = planejarRecuperacao('webgl2', 'contexto perdido', new GuardaDeRecuperacao({ agora: () => 0 }));
    expect(p.prefer).toBe('webgl2');
    expect(p.status).toContain('Reiniciando WebGL2');
  });
});
