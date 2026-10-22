import { coreSpan, openingCasing, openingFrame, openingLintel, openingSillBeam, openingSillBoard, type Id, type Opening, type Project } from '@hestia/model';
import type { OpeningGeometry, WallFrame } from '@hestia/engine';

/**
 * Peça da esquadria no 3D, em coordenadas locais do vão: x ao longo da parede, y na profundidade (0 = eixo da
 * parede), z acima do peitoril. A cena transforma cada peça em caixa e a põe no grupo do vão.
 */
export interface OpeningPiece {
  w: number;
  d: number;
  h: number;
  x: number;
  y: number;
  z: number;
  materialId: Id;
  /** Dobradiça da folha aberta: eixo `z` em x = at, ou eixo `x` em z = at. Ausente = peça fixa. */
  hinge?: { axis: 'x' | 'z'; at: number; angle: number };
}

/**
 * Peças 3D de um vão a partir do tipo e da família: batente, folha, vidro, montantes, alizar, peitoril saliente,
 * verga e contraverga. `open` abre as folhas (porta de giro a 90°, janela de correr/giro entreaberta). As espessuras
 * vêm do tipo; a profundidade do batente é limitada ao núcleo da parede (DEC-1).
 */
export function openingPieces(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame, H: number, open: boolean): OpeningPiece[] {
  const t = p.openingTypes[o.typeId];
  if (!t) return [];
  const out: OpeningPiece[] = [];
  const h = Math.min(g.height, H - g.sill);
  const core = coreSpan(f.type);
  const { frameWidth: jamb, frameDepth: depth, leafThickness: leaf, glassThickness: glassT } = openingFrame(t, core.to - core.from);
  const concrete = p.materials['mat_concreto'];
  const concreteId = t.frameMaterialId && concrete ? 'mat_concreto' : t.frameMaterialId;
  const add = (w: number, d: number, hh: number, x: number, y: number, z: number, materialId: Id, hinge?: OpeningPiece['hinge']): void => {
    out.push({ w, d, h: hh, x, y, z, materialId, ...(hinge ? { hinge } : {}) });
  };

  if (g.kind === 'window' && g.leaves === 0) {
    // Janela sem folha: só a soleira, sem caixilho nem vidro (a planta também desenha só a soleira).
    add(g.width, depth, jamb, 0, 0, jamb / 2, t.frameMaterialId);
  } else if (g.kind === 'window') {
    add(jamb, depth, h, -g.width / 2 + jamb / 2, 0, h / 2, t.frameMaterialId);
    add(jamb, depth, h, g.width / 2 - jamb / 2, 0, h / 2, t.frameMaterialId);
    add(g.width, depth, jamb, 0, 0, h - jamb / 2, t.frameMaterialId);
    add(g.width, depth, jamb, 0, 0, jamb / 2, t.frameMaterialId);
    const inner = g.width - jamb * 2;
    const glassH = h - jamb * 2;
    // O vidro ocupa exatamente o vão interno do caixilho: de `jamb` (face superior da soleira) a `h - jamb` (face
    // inferior da verga). O centro fica em `jamb + glassH/2`.
    const glassZ = jamb + glassH / 2;
    if (g.plan === 'sliding') {
      // Janela de correr: cada folha é um painel de vidro em trilho próprio, defasado na profundidade. Aberta, as
      // folhas deslizam para dentro do caixilho: a primeira fica parada e cada seguinte corre sobre ela, empilhada
      // em outro trilho. Nenhuma passa do vão interno (`±(W/2 − jamb)`).
      const n = Math.max(1, g.leaves);
      const panel = inner / n;
      for (let k = 0; k < n; k++) {
        const shift = open ? -k * panel : 0;
        add(panel, glassT, glassH, -inner / 2 + (k + 0.5) * panel + shift, depth * ((k + 1) / (n + 1) - 0.5), glassZ, t.glassMaterialId);
      }
      // Montante entre as folhas: fechado, no limite de sempre; aberto, sai do percurso das folhas (fica logo à
      // direita da pilha), sem mudar de dimensão.
      for (let i = 1; i < n; i++) {
        const closedX = -inner / 2 + i * panel;
        const x = open ? Math.max(closedX, -inner / 2 + panel + leaf / 2 + 1e-6) : closedX;
        add(leaf, depth, glassH, x, 0, glassZ, t.frameMaterialId);
      }
    } else {
      // Fixa, basculante e maxim-ar: uma folha de vidro no plano médio. Aberta, a maxim-ar/basculante gira pelo topo,
      // com o eixo na face inferior da verga (`jamb + glassH`).
      const hinge = open && (g.plan === 'casement' || g.plan === 'tilt') ? { axis: 'x' as const, at: jamb + glassH, angle: (g.flipFacing ? -1 : 1) * 0.35 } : undefined;
      add(inner, glassT, glassH, 0, 0, glassZ, t.glassMaterialId, hinge);
    }
    if (g.plan !== 'sliding') for (let i = 1; i < g.leaves; i++) add(leaf, depth, glassH, -inner / 2 + (i * inner) / g.leaves, 0, glassZ, t.frameMaterialId);
  } else {
    add(jamb, depth, h, -g.width / 2 + jamb / 2, 0, h / 2, t.frameMaterialId);
    add(jamb, depth, h, g.width / 2 - jamb / 2, 0, h / 2, t.frameMaterialId);
    add(g.width, depth, jamb, 0, 0, h - jamb / 2, t.frameMaterialId);
    const leafW = g.width - jamb * 2;
    const doorH = h - jamb;
    const dir = g.flipFacing ? -1 : 1;
    if (g.plan === 'sliding') {
      // Porta de correr: dois painéis em faces opostas. Aberta, o painel da direita corre sobre o da esquerda, no
      // mesmo vão livre: cada painel continua dentro de `±(W/2 − jamb)` e fora do núcleo da parede.
      const panelW = leafW / 2;
      const track = depth / 4;
      for (const s of [-1, 1] as const) {
        const shift = open && s === 1 ? -panelW : 0;
        add(panelW, leaf, doorH, (s * leafW) / 4 + shift, s * track, doorH / 2, t.frameMaterialId);
      }
    } else if (g.leaves === 2) {
      // Porta dupla: aberta, cada folha gira 90° na sua dobradiça (as duas para o mesmo lado).
      if (open) {
        const left = -g.width / 2 + jamb;
        const right = g.width / 2 - jamb;
        add(leafW / 2, leaf, doorH, left + leafW / 4, 0, doorH / 2, t.frameMaterialId, { axis: 'z', at: left, angle: (dir * Math.PI) / 2 });
        add(leafW / 2, leaf, doorH, right - leafW / 4, 0, doorH / 2, t.frameMaterialId, { axis: 'z', at: right, angle: (-dir * Math.PI) / 2 });
      } else {
        for (const x of [-leafW / 4, leafW / 4]) add(leafW / 2, leaf, doorH, x, 0, doorH / 2, t.frameMaterialId);
      }
    } else {
      // Porta de giro: aberta, gira 90° na dobradiça. O sinal do giro leva em conta o lado da dobradiça: com a
      // folha à direita do eixo, o mesmo ângulo a levaria para o lado oposto ao do arco da planta.
      const swing = g.plan === 'swing' || g.plan === 'double';
      if (open && swing) {
        const hinge = g.flipHand ? g.width / 2 - jamb : -g.width / 2 + jamb;
        const hand = g.flipHand ? -1 : 1;
        add(leafW, leaf, doorH, hinge + (g.flipHand ? -leafW / 2 : leafW / 2), 0, doorH / 2, t.frameMaterialId, { axis: 'z', at: hinge, angle: (dir * hand * Math.PI) / 2 });
      } else if (open && g.plan === 'pivot') {
        // Pivotante: eixo vertical a W/4 da ombreira de `flipHand`, folha inteira girando 90°. O sinal reproduz a
        // convenção da planta (`openingSymbol.ts`, `pivotDoor`): a banda curta (do eixo à ombreira) abre para o lado
        // de `flipFacing` e a banda longa para o lado oposto.
        const axis = (g.flipHand ? 1 : -1) * (g.width / 4);
        const angle = (dir * (g.flipHand ? 1 : -1) * Math.PI) / 2;
        add(leafW, leaf, doorH, 0, 0, doorH / 2, t.frameMaterialId, { axis: 'z', at: axis, angle });
      } else add(leafW, leaf, doorH, 0, 0, doorH / 2, t.frameMaterialId);
    }
  }

  // Alizar: em volta do vão, nas duas faces da parede.
  const casing = openingCasing(t);
  if (casing) {
    const cw = casing.width;
    const y = g.thickness / 2 + casing.thickness / 2;
    for (const side of [-1, 1] as const) {
      add(cw, casing.thickness, h + cw, -g.width / 2 - cw / 2, side * y, (h + cw) / 2, t.frameMaterialId);
      add(cw, casing.thickness, h + cw, g.width / 2 + cw / 2, side * y, (h + cw) / 2, t.frameMaterialId);
      add(g.width + 2 * cw, casing.thickness, cw, 0, side * y, h + cw / 2, t.frameMaterialId);
      if (g.kind === 'window') add(g.width + 2 * cw, casing.thickness, cw, 0, side * y, -cw / 2, t.frameMaterialId);
    }
  }
  // Peitoril saliente: projeta além das duas faces da parede, abaixo do vão.
  const sill = openingSillBoard(t);
  if (sill) add(g.width, g.thickness + 2 * sill.projection, sill.thickness, 0, 0, -sill.thickness / 2, t.frameMaterialId);
  // Verga e contraverga: peças de concreto, com transpasse além do vão.
  const lintel = openingLintel(t);
  if (lintel) add(g.width + 2 * lintel.over, depth, lintel.height, 0, 0, h + lintel.height / 2, concreteId);
  const beam = openingSillBeam(t);
  if (beam) add(g.width + 2 * beam.over, depth, beam.height, 0, 0, -beam.height / 2, concreteId);
  return out;
}
