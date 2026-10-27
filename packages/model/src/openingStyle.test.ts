import { describe, expect, it } from 'vitest';
import { createEmptyProject, DEFAULT_OPENING_TYPES } from './defaults.ts';
import {
  openingAngle2d,
  openingAngle3d,
  openingDetail2d,
  openingDetail3d,
  openingFrameDepth,
  openingFrameStyle,
  openingGrid,
  openingHandle,
  openingLeafSide,
  openingLeafStyle,
  openingLineConvention,
  openingPlanDisplay,
  openingSidelights,
  openingShowSwing,
  openingSwingStyle,
  openingTransom,
} from './openingStyle.ts';
import type { OpeningType } from './types.ts';

const tipo = (id: string): OpeningType => {
  const t = DEFAULT_OPENING_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`tipo ausente: ${id}`);
  return t;
};

const com = (id: string, extra: Partial<OpeningType>): OpeningType => ({ ...tipo(id), ...extra });

describe('openingStyle: padrões por leitura', () => {
  it('folha: porta flush, janela glass; estilo conhecido é respeitado', () => {
    expect(openingLeafStyle(tipo('ot_p90'))).toBe('flush');
    expect(openingLeafStyle(tipo('ot_jfixa60'))).toBe('glass');
    expect(openingLeafStyle(com('ot_p90', { leafStyle: 'panel' }))).toBe('panel');
    expect(openingLeafStyle(com('ot_p90', { leafStyle: 'desconhecido' as never }))).toBe('flush');
  });

  it('maçaneta: lever só na porta de giro e na dupla; none nas demais', () => {
    expect(openingHandle(tipo('ot_p90'))).toBe('lever');
    expect(openingHandle(tipo('ot_p160'))).toBe('lever');
    expect(openingHandle(tipo('ot_pp80'))).toBe('none');
    expect(openingHandle(tipo('ot_pc160'))).toBe('none');
    expect(openingHandle(tipo('ot_j120'))).toBe('none');
    expect(openingHandle(com('ot_p90', { handle: 'none' }))).toBe('none');
    expect(openingHandle(com('ot_pp80', { handle: 'knob' }))).toBe('knob');
    expect(openingHandle(com('ot_p90', { handle: 'puxador' as never }))).toBe('lever');
  });

  it('batente, grid e exibição têm os padrões da spec', () => {
    expect(openingFrameStyle(tipo('ot_p90'))).toBe('rebate');
    expect(openingFrameStyle(com('ot_p90', { frameStyle: 'aduela' }))).toBe('aduela');
    expect(openingFrameStyle(com('ot_p90', { frameStyle: 'x' as never }))).toBe('rebate');
    expect(openingGrid(tipo('ot_p90'))).toEqual({ cols: 1, rows: 1 });
    expect(openingGrid(com('ot_p90', { grid: { cols: 2, rows: 3 } }))).toEqual({ cols: 2, rows: 3 });
    expect(openingPlanDisplay(tipo('ot_p90'))).toBe('symbolic');
    expect(openingPlanDisplay(com('ot_p90', { planDisplay: 'projected' }))).toBe('projected');
    expect(openingDetail2d(tipo('ot_p90'))).toBe('scale');
    expect(openingDetail2d(com('ot_p90', { detail2d: 'high' }))).toBe('high');
    expect(openingDetail3d(tipo('ot_p90'))).toBe('view');
    expect(openingDetail3d(com('ot_p90', { detail3d: 'full' }))).toBe('full');
  });

  it('profundidade do batente: parede total (padrão), núcleo ou valor fixo limitado à parede', () => {
    const base = tipo('ot_p90');
    expect(openingFrameDepth(base, 0.184, 0.14)).toEqual({ depth: 0.184, centerOffset: 0 });
    expect(openingFrameDepth({ ...base, frameDepthMode: 'core' }, 0.184, 0.14)).toEqual({ depth: 0.14, centerOffset: 0 });
    expect(openingFrameDepth({ ...base, frameDepthMode: 'fixed', frameDepth: 0.09 }, 0.184, 0.14)).toEqual({
      depth: 0.09,
      centerOffset: 0,
    });
    expect(openingFrameDepth({ ...base, frameDepthMode: 'fixed', frameDepth: 0.5 }, 0.184, 0.14)).toEqual({
      depth: 0.184,
      centerOffset: 0,
    });
    expect(openingFrameDepth({ ...base, frameDepthMode: 'fixed' }, 0.184, 0.14).depth).toBeCloseTo(0.09, 9);
    expect(openingFrameDepth({ ...base, frameDepthMode: 'x' as never }, 0.184, 0.14)).toEqual({ depth: 0.184, centerOffset: 0 });
  });

  it('ângulos: 90 em planta; 3D 90 na porta e na janela de giro, 30 na maxim-ar e basculante', () => {
    expect(openingAngle2d(tipo('ot_p90'))).toBe(90);
    expect(openingAngle3d(tipo('ot_p90'))).toBe(90);
    expect(openingAngle3d(tipo('ot_j60'))).toBe(30);
    const tilt = com('ot_j60', { plan: 'tilt' });
    expect(openingAngle3d(tilt)).toBe(30);
    expect(openingAngle3d(tipo('ot_jfixa60'))).toBe(90);
    expect(openingAngle2d(com('ot_p90', { angle2d: 45 }))).toBe(45);
    expect(openingAngle3d(com('ot_p90', { angle3d: 0 }))).toBe(0);
  });

  it('ângulos padrão por família do catálogo: 2D 55 no dobrável e 60 na janela de abrir; 3D 45/70/75/30', () => {
    const semAngulo = (id: string): OpeningType => {
      const { angle2d: _a2, angle3d: _a3, ...resto } = tipo(id);
      return resto;
    };
    expect(openingAngle2d(semAngulo('ot_pd120'))).toBe(55);
    expect(openingAngle2d(semAngulo('ot_ja120'))).toBe(60);
    expect(openingAngle2d(semAngulo('ot_p90'))).toBe(90);
    expect(openingAngle3d(semAngulo('ot_jv80'))).toBe(45);
    expect(openingAngle3d(semAngulo('ot_pd120'))).toBe(70);
    expect(openingAngle3d(semAngulo('ot_ps90'))).toBe(75);
    expect(openingAngle3d(semAngulo('ot_j60'))).toBe(30);
    expect(openingAngle3d(semAngulo('ot_ja120'))).toBe(90);
    expect(openingAngle3d(semAngulo('ot_jp80'))).toBe(90);
    expect(openingAngle3d(semAngulo('ot_pe80'))).toBe(90);
    expect(openingAngle3d(semAngulo('ot_pg300'))).toBe(90);
    expect(openingAngle3d(semAngulo('ot_jg90'))).toBe(90);
    // A veneziana tem limite próprio de 70° (spec E §3.5).
    expect(openingAngle3d(com('ot_jv80', { angle3d: 120 }))).toBe(70);
    expect(openingAngle3d(com('ot_jv80', { angle3d: 60 }))).toBe(60);
  });

  it('valores inválidos caem no padrão; ângulos limitam 0..120 e grid 1..8', () => {
    expect(openingAngle2d(com('ot_p90', { angle2d: Number.NaN }))).toBe(90);
    expect(openingAngle2d(com('ot_p90', { angle2d: -10 }))).toBe(0);
    expect(openingAngle2d(com('ot_p90', { angle2d: 500 }))).toBe(120);
    expect(openingAngle3d(com('ot_p90', { angle3d: Infinity }))).toBe(90);
    expect(openingGrid(com('ot_p90', { grid: { cols: 0, rows: 300 } }))).toEqual({ cols: 1, rows: 8 });
    expect(openingGrid(com('ot_p90', { grid: { cols: Number.NaN, rows: 2.6 } }))).toEqual({ cols: 1, rows: 3 });
  });

  it('bandeira: ausente/inválida = nenhuma; altura limitada e fixa por padrão', () => {
    expect(openingTransom(tipo('ot_p90'))).toBeNull();
    expect(openingTransom(com('ot_p90', { transom: { height: 0 } }))).toBeNull();
    expect(openingTransom(com('ot_p90', { transom: { height: Number.NaN } }))).toBeNull();
    expect(openingTransom(com('ot_p90', { transom: { height: 0.4 } }))).toEqual({ height: 0.4, fixed: true });
    expect(openingTransom(com('ot_p90', { transom: { height: 0.4, fixed: false } }))).toEqual({ height: 0.4, fixed: false });
    expect(openingTransom(com('ot_p90', { transom: { height: 9 } }))!.height).toBe(2.1);
  });

  it('bandeiras laterais: nenhum lado ligado = nenhuma; largura válida', () => {
    expect(openingSidelights(tipo('ot_p90'))).toBeNull();
    expect(openingSidelights(com('ot_p90', { sidelights: { width: 0.3 } }))).toBeNull();
    expect(openingSidelights(com('ot_p90', { sidelights: { left: true, width: 0 } }))).toBeNull();
    expect(openingSidelights(com('ot_p90', { sidelights: { left: true, right: true, width: 0.3 } }))).toEqual({
      left: true,
      right: true,
      width: 0.3,
    });
  });

  it('giro, estilo do arco e lado da folha', () => {
    expect(openingShowSwing(tipo('ot_p90'))).toBe(true);
    expect(openingShowSwing(com('ot_p90', { showSwing: false }))).toBe(false);
    expect(openingSwingStyle(tipo('ot_p90'))).toBe('arc');
    expect(openingSwingStyle(com('ot_p90', { swingStyle: 'dash' }))).toBe('dash');
    expect(openingSwingStyle(com('ot_p90', { swingStyle: 'x' as never }))).toBe('arc');
    expect(openingLeafSide(tipo('ot_p90'))).toBe('swing');
    expect(openingLeafSide(com('ot_p90', { leafSide: 'opposite' }))).toBe('opposite');
  });

  it('convenção da linha de abertura: padrão latch/toward e validação dos campos', () => {
    const p = createEmptyProject();
    expect(openingLineConvention(p)).toEqual({ apex: 'latch', dashed: 'toward' });
    const custom = { ...p, settings: { ...p.settings, openingLine: { apex: 'hinge' as const, dashed: 'away' as const } } };
    expect(openingLineConvention(custom)).toEqual({ apex: 'hinge', dashed: 'away' });
    const invalido = {
      ...p,
      settings: { ...p.settings, openingLine: { apex: 'x', dashed: 'y' } as never },
    };
    expect(openingLineConvention(invalido)).toEqual({ apex: 'latch', dashed: 'toward' });
  });
});
