/**
 * Intervalo de vista da planta de um nível (Revit: View Range; docs/05 §5, decisão 0013).
 * Todas as cotas são em metros RELATIVAS à elevação do nível da planta.
 */
export interface ViewRange {
  /** Topo: acima dele nada aparece (padrão 2,30 m, como o Revit). */
  top: number;
  /** Plano de corte: elementos que o atravessam são desenhados cortados (padrão 1,20 m). */
  cut: number;
  /** Base: abaixo dela só a profundidade de vista (padrão 0). */
  bottom: number;
  /** Profundidade de vista: cota (≤ base) até onde elementos abaixo da base aparecem no estilo "além" (padrão = base). */
  depth: number;
  /** Direção da vista: 'down' = planta baixa. 'up' (planta de forro) está reservada, ainda sem desenho. */
  direction: 'down' | 'up';
}

export const DEFAULT_VIEW_RANGE: ViewRange = { top: 2.3, cut: 1.2, bottom: 0, depth: 0, direction: 'down' };

/** Mensagens de validação (pt-BR) na ordem das regras: topo ≥ corte ≥ base ≥ profundidade. */
export function viewRangeIssues(v: ViewRange): string[] {
  const out: string[] = [];
  const finite = [v.top, v.cut, v.bottom, v.depth].every((x) => typeof x === 'number' && Number.isFinite(x));
  if (!finite) out.push('As cotas do intervalo de vista devem ser números finitos, em metros.');
  else {
    if (!(v.top >= v.cut)) out.push('O topo do intervalo de vista deve estar acima ou no plano de corte.');
    if (!(v.cut >= v.bottom)) out.push('O plano de corte deve estar acima ou na base do intervalo de vista.');
    if (!(v.depth <= v.bottom)) out.push('A profundidade de vista deve estar abaixo ou na base do intervalo de vista.');
  }
  if (v.direction !== 'down' && v.direction !== 'up') out.push('A direção da vista deve ser "down" ou "up".');
  return out;
}

/** Cópia com valores finitos (NaN/∞ viram o padrão) e ordem topo ≥ corte ≥ base ≥ profundidade forçada. */
export function normalizeViewRange(v: Partial<ViewRange> | undefined): ViewRange {
  const d = DEFAULT_VIEW_RANGE;
  const num = (x: unknown, f: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : f);
  const cut = num(v?.cut, d.cut);
  const bottom = Math.min(num(v?.bottom, d.bottom), cut);
  return {
    top: Math.max(num(v?.top, d.top), cut),
    cut,
    bottom,
    depth: Math.min(num(v?.depth, bottom), bottom),
    direction: v?.direction === 'up' ? 'up' : 'down',
  };
}
