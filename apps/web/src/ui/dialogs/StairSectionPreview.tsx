import type { ReactElement } from 'react';
import type { StairType } from '@hestia/model';

/**
 * Prévia simples de corte do tipo de escada: três degraus com o espelho e o piso do tipo, e o corpo da escada
 * (monolítico: profundidade estrutural abaixo da linha dos degraus). Ilustrativa, não é o corte do projeto.
 */
export function StairSectionPreview({ type }: { type: StairType }): ReactElement {
  const n = 3;
  const r = Math.max(type.maxRiser, 0.05);
  const t = Math.max(type.minTread, 0.1);
  const mono = type.runStyle === 'monolithic';
  const d = mono ? Math.max(type.structuralDepth, 0) : 0;
  // Perfil dos degraus (y para cima, chão em y = 0).
  type Pt = [number, number];
  const top: Pt[] = [[0, 0]];
  for (let i = 0; i < n; i++) top.push([i * t, (i + 1) * r], [(i + 1) * t, (i + 1) * r]);
  const body: Pt[] = mono ? [...top, [n * t, n * r - d], [0, -d]] : [...top, [n * t, 0]];
  const pad = 0.25;
  const xs = body.map((q) => q[0]);
  const ys = body.map((q) => q[1]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const H = maxY - minY;
  const sy = (y: number): number => maxY - y;
  const pts = body.map(([x, y]) => `${(x - minX).toFixed(3)},${sy(y).toFixed(3)}`).join(' ');
  const cm = (m: number): string => (m * 100).toFixed(1).replace('.', ',');
  return (
    <svg viewBox={`0 0 ${(maxX - minX).toFixed(3)} ${H.toFixed(3)}`} width="100%" role="img" aria-label="Prévia do corte da escada" style={{ background: 'var(--bg-soft, transparent)', borderRadius: 6 }}>
      <polygon points={pts} fill="var(--accent-soft, rgba(60,110,200,.18))" stroke="var(--fg, #333)" strokeWidth={0.02} />
      <line x1={0} x2={maxX - minX} y1={sy(0)} y2={sy(0)} stroke="var(--fg-faint, #999)" strokeWidth={0.015} />
      <text x={0.05} y={H - 0.08} fontSize={0.12} fill="var(--fg-soft, #555)">
        Espelho {cm(r)} cm · Piso {cm(t)} cm{mono ? ` · Estrutura ${cm(d)} cm` : ''}
      </text>
    </svg>
  );
}
