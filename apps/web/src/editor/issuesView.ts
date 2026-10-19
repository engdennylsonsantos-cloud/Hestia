import { isFloor, isOpening, isWall, type Id, type Project, type ValidationIssue, type ValidationSeverity } from '@hestia/model';

export interface IssueGroup {
  severity: ValidationSeverity;
  title: string;
  items: ValidationIssue[];
}

/** Destino de "Ir para": elemento a selecionar, nível a abrir (se houver) e ponto central da parede. */
export interface IssueTarget {
  elementId: Id;
  /** Nível da parede (ou da parede anfitriã da abertura); null quando o nível não existe. */
  levelId: Id | null;
  /** Ponto médio da parede; null quando o elemento não está ligado a uma parede. */
  center: { x: number; y: number } | null;
  /** Caixa do piso (contorno): a vista enquadra a caixa em vez do ponto. Só existe para pisos. */
  box?: { minX: number; minY: number; maxX: number; maxY: number };
}

const TITLE: Record<ValidationSeverity, string> = { error: 'Erros', warning: 'Avisos' };

/** Agrupa por severidade, erros primeiro. Grupos vazios não aparecem; a ordem original é mantida dentro de cada grupo. */
export function groupIssues(issues: readonly ValidationIssue[]): IssueGroup[] {
  const order: ValidationSeverity[] = ['error', 'warning'];
  return order
    .map((severity) => ({ severity, title: TITLE[severity], items: issues.filter((i) => i.severity === severity) }))
    .filter((g) => g.items.length > 0);
}

/** Resumo para o botão da barra de status, ex.: "2 erros · 3 avisos". Vazio quando não há problemas. */
export function summarize(issues: readonly ValidationIssue[]): string {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const parts: string[] = [];
  if (errors > 0) parts.push(errors === 1 ? '1 erro' : `${errors} erros`);
  if (warnings > 0) parts.push(warnings === 1 ? '1 aviso' : `${warnings} avisos`);
  return parts.join(' · ');
}

/** Severidade mais grave presente, ou null quando não há problemas. */
export function worstSeverity(issues: readonly ValidationIssue[]): ValidationSeverity | null {
  if (issues.some((i) => i.severity === 'error')) return 'error';
  return issues.length > 0 ? 'warning' : null;
}

/**
 * Resolve o alvo de um aviso. Aberturas usam a parede anfitriã para nível e centro.
 * Devolve null quando o aviso não tem elemento ou o elemento não existe mais.
 */
export function issueTarget(p: Project, issue: ValidationIssue): IssueTarget | null {
  const id = issue.elementId;
  if (!id) return null;
  const el = p.elements[id];
  if (!el) return null;
  if (isFloor(el)) {
    const xs = el.boundary.map((q) => q.x);
    const ys = el.boundary.map((q) => q.y);
    if (xs.length === 0) return null;
    const box = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    return {
      elementId: id,
      levelId: p.levels.some((l) => l.id === el.levelId) ? el.levelId : null,
      center: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
      box,
    };
  }
  const host = isOpening(el) ? p.elements[el.hostId] : undefined;
  const wall = isWall(el) ? el : isWall(host) ? host : null;
  const levelExists = wall !== null && p.levels.some((l) => l.id === wall.levelId);
  return {
    elementId: id,
    levelId: wall && levelExists ? wall.levelId : null,
    center: wall ? { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 } : null,
  };
}
