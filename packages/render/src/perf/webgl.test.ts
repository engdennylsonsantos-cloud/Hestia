import { describe, expect, it } from 'vitest';
import { ContadoresPerf } from './contadores.ts';
import { instrumentarWebGl2 } from './webgl.ts';

const TRIANGLES = 4;
const LINES = 1;
const BUFFER_ARRAY = 34962;

/** Contexto mínimo: os métodos originais registram a chamada e não fazem nada. Sem extensão de timer por padrão. */
function glFalso(comTimer = false): { gl: WebGL2RenderingContext; chamadas: string[] } {
  const chamadas: string[] = [];
  const registrar = (nome: string) => (): void => {
    chamadas.push(nome);
  };
  const query = { id: 1 };
  const gl: Record<string, unknown> = {
    getExtension: (nome: string) => (comTimer && nome === 'EXT_disjoint_timer_query_webgl2' ? { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb } : null),
    drawArrays: registrar('drawArrays'),
    drawArraysInstanced: registrar('drawArraysInstanced'),
    drawElements: registrar('drawElements'),
    drawElementsInstanced: registrar('drawElementsInstanced'),
    drawRangeElements: registrar('drawRangeElements'),
    bufferData: registrar('bufferData'),
    bufferSubData: registrar('bufferSubData'),
  };
  if (comTimer) {
    gl.QUERY_RESULT_AVAILABLE = 0x8867;
    gl.QUERY_RESULT = 0x8866;
    gl.createQuery = () => query;
    gl.beginQuery = registrar('beginQuery');
    gl.endQuery = registrar('endQuery');
    gl.deleteQuery = registrar('deleteQuery');
    gl.getParameter = () => false; // GPU_DISJOINT_EXT = false
    gl.getQueryParameter = (_q: unknown, pname: number) => (pname === 0x8867 ? true : 5_000_000);
  }
  return { gl: gl as unknown as WebGL2RenderingContext, chamadas };
}

describe('instrumentação do WebGL2', () => {
  it('conta draw calls, triângulos e uploads entre quadros e chama o método original', () => {
    const { gl, chamadas } = glFalso();
    const c = new ContadoresPerf();
    c.ativar();
    const instr = instrumentarWebGl2(gl, c);
    expect(instr.timer).toBe('indisponivel');

    c.iniciarQuadro(1000);
    gl.drawArrays(TRIANGLES, 0, 6); // 1 chamada, 2 triângulos
    gl.drawArraysInstanced(TRIANGLES, 0, 6, 3); // 1 chamada, 6 triângulos
    gl.drawElements(TRIANGLES, 12, 5123, 0); // 1 chamada, 4 triângulos
    gl.drawElementsInstanced(TRIANGLES, 6, 5123, 0, 2); // 1 chamada, 4 triângulos
    gl.drawRangeElements(TRIANGLES, 0, 3, 3, 5123, 0); // 1 chamada, 1 triângulo
    gl.drawArrays(LINES, 0, 10); // 1 chamada, 0 triângulos
    gl.bufferData(BUFFER_ARRAY, 120, 35044); // 120 bytes
    gl.bufferSubData(BUFFER_ARRAY, 0, new Float32Array(4)); // 16 bytes
    expect(instr.desenhouNoQuadro()).toBe(true);
    c.encerrarQuadro(1001);

    const s = c.snapshot();
    expect(s.quadro).toMatchObject({ drawCalls: 6, triangulos: 17, uploads: 2, uploadBytes: 136 });
    expect(chamadas).toEqual([
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
      'drawRangeElements',
      'drawArrays',
      'bufferData',
      'bufferSubData',
    ]);

    instr.remover();
    c.iniciarQuadro(1010);
    gl.drawArrays(TRIANGLES, 0, 3);
    c.encerrarQuadro(1011);
    expect(c.snapshot().quadro).toMatchObject({ drawCalls: 0, triangulos: 0 });
  });

  it('com EXT_disjoint_timer_query_webgl2 mede o tempo de GPU e lê o resultado na consulta', () => {
    const { gl } = glFalso(true);
    const c = new ContadoresPerf();
    c.ativar();
    const instr = instrumentarWebGl2(gl, c);
    expect(instr.timer).toBe('disponivel');

    c.iniciarQuadro(2000);
    instr.iniciar(); // beginQuery
    instr.encerrar(); // endQuery + resultado disponível (5 ms)
    c.encerrarQuadro(2001);

    const s = c.snapshot();
    expect(s.gpu.timer).toBe('disponivel');
    expect(s.gpu.ms).toBe(5);
    expect(s.indisponiveis).toEqual([]);
  });

  it('sem a extensão, registra o motivo em indisponíveis', () => {
    const { gl } = glFalso();
    const c = new ContadoresPerf();
    c.ativar();
    instrumentarWebGl2(gl, c);
    const s = c.snapshot();
    expect(s.gpu.timer).toBe('indisponivel');
    expect(s.indisponiveis.join(' ')).toContain('EXT_disjoint_timer_query_webgl2');
  });
});
