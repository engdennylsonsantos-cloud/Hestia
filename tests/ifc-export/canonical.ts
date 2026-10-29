import type { Project } from '@hestia/model';

/** Assinatura canônica para comparar modelo original × reimportado sem depender de ordem de objeto. */
export interface ResumoCanonico {
  schemaVersion: number;
  levels: number;
  counts: Record<string, number>;
  /** Espessuras totais de parede usadas (m, 3 casas), ordenadas: pega troca de camada/espessura no round-trip. */
  wallThickness: number[];
}

const KINDS = ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'stair', 'room', 'generic'] as const;

/** Resumo estável do projeto: contagens por `kind`, níveis e espessuras de parede. */
export function resumoCanonico(p: Project): ResumoCanonico {
  const counts: Record<string, number> = {};
  for (const kind of KINDS) counts[kind] = 0;
  for (const e of Object.values(p.elements)) counts[e.kind] = (counts[e.kind] ?? 0) + 1;

  const thickness = new Set<number>();
  for (const wall of Object.values(p.elements)) {
    if (wall.kind !== 'wall') continue;
    const tipo = p.wallTypes[wall.typeId];
    if (!tipo) continue;
    thickness.add(Math.round(tipo.layers.reduce((s, l) => s + l.thickness, 0) * 1000) / 1000);
  }

  return {
    schemaVersion: p.schemaVersion,
    levels: p.levels.length,
    counts,
    wallThickness: [...thickness].sort((a, b) => a - b),
  };
}
