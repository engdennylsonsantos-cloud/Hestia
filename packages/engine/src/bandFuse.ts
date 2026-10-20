import { difference, intersection, multiArea, unionClipper, type MultiPolygon } from '@hestia/geom';
import type { LayerBand } from './types.ts';

const FUSE_EPS_Z = 1e-6;
const FUSE_MIN_AREA = 1e-12;

/** Chave do topo inclinado: duas faixas só se fundem se seguem exatamente o mesmo plano. */
const slopeKey = (s: LayerBand['slope']): string => (s ? JSON.stringify(s) : '');

const hasArea = (m: MultiPolygon): boolean => m.length > 0 && multiArea(m) > FUSE_MIN_AREA;

/**
 * Limpa o resultado de uma booleana: a diferença/interseção pode deixar anéis degenerados (espículas de largura zero
 * que voltam ao longo da própria borda). Sem área, mas as arestas delas viram linhas falsas no 3D e no corte. A união
 * pelo Clipper descarta essas espículas e devolve só as regiões de área positiva.
 */
const clean = (m: MultiPolygon): MultiPolygon => (m.length ? unionClipper(m) : m);

/**
 * Funde as faixas de uma camada em prismas contínuos no sentido vertical. Cada região em planta sobrevive enquanto
 * estiver presente nas faixas consecutivas (mesma chave de inclinação); só se divide onde a planta muda, isto é, na
 * borda do vão. Assim a parede fora do vão é um prisma só de base a topo, e a soleira e a verga aparecem apenas
 * onde o vão existe, sem faces horizontais coplanares que emendam a parede inteira. O volume é o mesmo: as regiões
 * de cada faixa continuam particionadas (sem sobreposição) e nenhuma área é criada nem perdida.
 *
 * A comparação de "mesmo polígono" é feita pela booleana (diferença vazia = a região continua), que não depende do
 * vértice inicial nem do sentido dos anéis.
 */
export function fuseBands(bands: LayerBand[]): LayerBand[] {
  const out: LayerBand[] = [];
  let open: LayerBand[] = [];
  let zEnd = 0;
  for (const b of [...bands].sort((x, y) => x.z0 - y.z0)) {
    // Quebra de continuidade vertical: fecha tudo o que estava aberto.
    if (open.length && Math.abs(b.z0 - zEnd) > FUSE_EPS_Z) {
      out.push(...open);
      open = [];
    }
    const key = slopeKey(b.slope);
    const next: LayerBand[] = [];
    const kept: MultiPolygon[] = [];
    for (const o of open) {
      if (slopeKey(o.slope) !== key) {
        out.push(o);
        continue;
      }
      // A parte da região que sai na faixa nova fecha em `b.z0`; a que continua segue com a faixa nova.
      const rest = clean(difference(o.poly, b.poly));
      if (!hasArea(rest)) {
        next.push({ ...o, z1: b.z1 });
        kept.push(o.poly);
        continue;
      }
      out.push({ z0: o.z0, z1: b.z0, poly: rest, slope: o.slope });
      const inside = clean(intersection(o.poly, b.poly));
      if (hasArea(inside)) {
        next.push({ z0: o.z0, z1: b.z1, poly: inside, slope: o.slope });
        kept.push(inside);
      }
    }
    // Região nova da faixa (ainda não coberta pelas que continuam) abre a partir de `b.z0`.
    const fresh = kept.length ? clean(difference(b.poly, ...kept)) : b.poly;
    if (hasArea(fresh)) next.push({ z0: b.z0, z1: b.z1, poly: fresh, slope: b.slope });
    open = next;
    zEnd = b.z1;
  }
  out.push(...open);
  return out;
}
