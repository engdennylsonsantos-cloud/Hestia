import { frameOfWall, openingExtents } from '@hestia/engine';
import { openingTypeById, openingsOfWall, type Id, type Opening, type Project } from '@hestia/model';

const EPS = 1e-6;

/** Ajuste proposto para uma parede: novo comprimento e/ou deslocamento do início ao longo do eixo (m). */
export interface WallResize {
  length?: number;
  /** Quanto o início da parede avança (+) ou recua (−) ao longo do eixo; as esquadrias mantêm a posição no mundo. */
  startShift?: number;
}

const labelOf = (p: Project, o: Opening): string => `${o.kind === 'door' ? 'a porta' : 'a janela'} ${o.mark || openingTypeById(p, o.typeId)?.code || ''}`.trim();
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Meia-largura (recorte do batente) da esquadria; sem tipo ou parede, cai na largura do tipo. */
function halfOf(p: Project, o: Opening): number {
  const t = openingTypeById(p, o.typeId);
  const f = frameOfWall(p, o.hostId);
  if (!f || !t) return (t?.width ?? 0.8) / 2;
  return openingExtents(p, o, f, 1).frame;
}

/**
 * Valida o ajuste de uma parede contra as esquadrias hospedadas: cada uma deve continuar inteira em `[0, comprimento]`
 * depois do ajuste (as posições são `offset − startShift`) e duas esquadrias que não se tocavam não podem passar a se
 * sobrepor. Devolve a mensagem de recusa ou null; quem chama NÃO emite comando nenhum quando há mensagem.
 */
export function hostedConflicts(project: Project, wallId: Id, next: WallResize): string | null {
  const frame = frameOfWall(project, wallId);
  if (!frame) return null;
  const length = next.length ?? frame.length;
  const shift = next.startShift ?? 0;
  const hosted = openingsOfWall(project, wallId).map((o) => ({ o, half: halfOf(project, o) }));
  for (const { o, half } of hosted) {
    const c = o.offset - shift;
    if (c - half < -EPS || c + half > length + EPS) {
      return `${capital(labelOf(project, o))} sairia da parede. Mova ou apague a esquadria antes.`;
    }
  }
  return null;
}
