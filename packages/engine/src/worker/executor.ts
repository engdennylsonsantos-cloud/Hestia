import type { Id, Project } from '@hestia/model';
import { resolveLevel, type ResolveCache } from '../resolve.ts';
import { resolveFloors } from '../floors.ts';
import { resolveSlabs } from '../slabs.ts';
import { resolveRoofs } from '../roofs.ts';
import { resolveRooms } from '../rooms.ts';
import type { TipoResolucao } from './protocolo.ts';

/**
 * Executa uma resolução de nível. É a mesma função usada no worker e na thread principal (fallback): o resultado não
 * depende de onde roda. `cache` só existe na thread principal; no worker, omitido, vale o cache do próprio módulo.
 */
export function executarResolucao(tipo: TipoResolucao, p: Project, nivel: Id, cache?: ResolveCache): unknown {
  switch (tipo) {
    case 'nivel':
      return resolveLevel(p, nivel, cache);
    case 'pisos':
      return resolveFloors(p, nivel);
    case 'lajes':
      return resolveSlabs(p, nivel);
    case 'telhados':
      return resolveRoofs(p, nivel);
    case 'ambientes':
      return resolveRooms(p, nivel);
  }
}
