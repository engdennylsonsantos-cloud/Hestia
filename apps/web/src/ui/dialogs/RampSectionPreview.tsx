import type { ReactElement } from 'react';
import { formatRampSlope, type RampType } from '@hestia/model';

/**
 * Prévia simples do corte do lance da rampa: a parte inclinada (face superior) e a espessura estrutural, subindo da
 * esquerda para a direita, com a inclinação padrão do tipo. Ilustrativa, não é o corte do projeto.
 */
export function RampSectionPreview({ type }: { type: RampType }): ReactElement {
  const slope = Math.max(type.defaultSlope, 0);
  const t = Math.min(8, Math.max(4, type.structuralDepth * 40));
  return (
    <svg viewBox="0 0 100 58" width="100%" role="img" aria-label="Prévia do corte da rampa" style={{ background: 'var(--bg-soft, transparent)', borderRadius: 6 }}>
      <line x1={4} y1={44} x2={96} y2={44} stroke="var(--fg-soft, #555)" strokeWidth={0.5} />
      <polygon
        points={`8,${38} 88,16 88,${16 + t} 8,${38 + t}`}
        fill="var(--accent-soft, rgba(60,110,200,.18))"
        stroke="var(--accent, #3c6ec8)"
        strokeWidth={0.8}
      />
      <line x1={8} y1={38} x2={88} y2={16} stroke="var(--fg-soft, #555)" strokeWidth={0.5} strokeDasharray="3 2" />
      <text x={8} y={55} fontSize={4.6} fill="var(--fg-soft, #555)">i = {formatRampSlope(slope)}</text>
    </svg>
  );
}
