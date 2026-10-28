import type { ReactElement } from 'react';
import { formatQuantity, unitSymbol, type StairType } from '@hestia/model';
import { machineNumber } from '@hestia/geom';
import { useUnits } from '../useUnits.ts';
import { stairPostTreads, stairSectionProfile, type ProfilePoint } from './stairSectionProfile.ts';

/**
 * Prévia simples de corte do tipo de escada: três degraus com o espelho e o piso do tipo, e o corpo da escada. No
 * monolítico, a face inferior segue o estilo (lisa: faixa paralela à rampa; escalonada: fundo em degraus). No poste
 * (caracol com poste central), os degraus são soltos e não há espelho. Ilustrativa, não é o corte do projeto.
 */
export function StairSectionPreview({ type }: { type: StairType }): ReactElement {
  const units = useUnits();
  const r = Math.max(type.maxRiser, 0.05);
  const t = Math.max(type.minTread, 0.1);
  const post = type.runStyle === 'post';
  const mono = type.runStyle === 'monolithic';
  const d = mono ? Math.max(type.structuralDepth, 0) : 0;
  const polygons: ProfilePoint[][] = post ? stairPostTreads(type) : [stairSectionProfile(type)];
  const all = polygons.flat();
  const pad = 0.25;
  const xs = all.map((q) => q[0]);
  const ys = all.map((q) => q[1]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const H = maxY - minY;
  const sy = (y: number): number => maxY - y;
  const toPts = (poly: ProfilePoint[]): string => poly.map(([x, y]) => `${machineNumber(x - minX, 3)},${machineNumber(sy(y), 3)}`).join(' ');
  const cm = (m: number): string => formatQuantity(units, 'smallLength', m, { withUnit: false });
  const label = post
    ? `Sem espelho · Piso ${cm(t)} ${unitSymbol(units, 'smallLength')} · Degrau ${cm(type.treadThickness)} ${unitSymbol(units, 'smallLength')} · Sobreposição ${cm(type.treadOverlap)} ${unitSymbol(units, 'smallLength')}`
    : `Espelho ${cm(r)} ${unitSymbol(units, 'smallLength')} · Piso ${cm(t)} cm${mono ? ` · Estrutura ${cm(d)} ${unitSymbol(units, 'smallLength')} · Face ${type.undersideStyle === 'stepped' ? 'escalonada' : 'lisa'}` : ''}`;
  return (
    <svg viewBox={`0 0 ${machineNumber(maxX - minX, 3)} ${machineNumber(H, 3)}`} width="100%" role="img" aria-label="Prévia do corte da escada" style={{ background: 'var(--bg-soft, transparent)', borderRadius: 6 }}>
      {polygons.map((poly, i) => (
        <polygon key={i} points={toPts(poly)} fill="var(--accent-soft, rgba(60,110,200,.18))" stroke="var(--fg, #333)" strokeWidth={0.02} />
      ))}
      <line x1={0} x2={maxX - minX} y1={sy(0)} y2={sy(0)} stroke="var(--fg-faint, #999)" strokeWidth={0.015} />
      <text x={0.05} y={H - 0.08} fontSize={0.12} fill="var(--fg-soft, #555)">
        {label}
      </text>
    </svg>
  );
}
