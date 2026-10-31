import { describe, expect, it } from 'vitest';
import { deveTratarGrip } from './OpeningFlipGrips.tsx';

describe('alças de inverter abertura (OpeningFlipGrips)', () => {
  it('só o botão esquerdo pertence à alça', () => {
    expect(deveTratarGrip(0)).toBe(true);
    expect(deveTratarGrip(1)).toBe(false);
    expect(deveTratarGrip(2)).toBe(false);
  });

  it('botões auxiliares seguem para o canvas (pan/menu), assim como valores inesperados', () => {
    expect(deveTratarGrip(3)).toBe(false);
    expect(deveTratarGrip(4)).toBe(false);
    expect(deveTratarGrip(-1)).toBe(false);
  });
});
