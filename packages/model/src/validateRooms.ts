import { isRoom, type Project, type Room } from './types.ts';
import type { ValidationIssue } from './validate.ts';

const label = (r: Room): string => (r.number ? `"${r.number}" (${r.id})` : `"${r.id}"`);

/** Erros simples de modelo do ambiente: nome vazio, nível inexistente, pé-direito inválido e referência não finita. */
function roomIssuesOf(p: Project, r: Room): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(r);
  const push = (code: string, message: string, severity: ValidationIssue['severity'] = 'error'): void => void out.push({ severity, code, message, elementId: r.id });
  if (!r.name.trim()) push('room-empty-name', `Ambiente ${name} está sem nome.`);
  if (!p.levels.some((l) => l.id === r.levelId)) push('room-level-missing', `Ambiente ${name} está no nível "${r.levelId}", que não existe.`);
  if (r.ceilingHeight !== undefined && !(Number.isFinite(r.ceilingHeight) && r.ceilingHeight > 0)) push('room-ceiling-height', `Ambiente ${name} tem pé-direito inválido (${r.ceilingHeight}).`);
  if (r.referencePoint && (!Number.isFinite(r.referencePoint.x) || !Number.isFinite(r.referencePoint.y))) push('room-reference-invalid', `Ambiente ${name} tem ponto de referência inválido.`);
  return out;
}

/** Números repetidos no mesmo nível: aviso, como no Revit (que permite continuar). */
function duplicateNumbers(p: Project): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const level of p.levels) {
    const seen = new Map<string, Room>();
    for (const r of Object.values(p.elements).filter(isRoom)) {
      if (r.levelId !== level.id) continue;
      const number = r.number.trim();
      if (!number) continue;
      const first = seen.get(number);
      if (first) {
        out.push({ severity: 'warning', code: 'room-number-duplicate', message: `O número "${number}" se repete no nível ${level.name} (ambientes "${first.name}" e "${r.name}").`, elementId: r.id, ids: [first.id, r.id] });
      } else {
        seen.set(number, r);
      }
    }
  }
  return out;
}

/** Problemas de modelo de todos os ambientes do projeto. */
export function roomIssues(p: Project): ValidationIssue[] {
  return [
    ...Object.values(p.elements).filter(isRoom).flatMap((r) => roomIssuesOf(p, r)),
    ...duplicateNumbers(p),
  ];
}
