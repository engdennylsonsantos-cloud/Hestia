import type { Command } from './commands.ts';
import { createEmptyProject } from './defaults.ts';
import { ProjectStore } from './history.ts';
import type { Opening, Project, Wall } from './types.ts';
import { DEFAULT_JOIN, makeWall } from './wall.ts';
import { casaAltoPadrao } from './templateCasaAltoPadrao.ts';
import { predio10 } from './templatePredio10.ts';

export type TemplateId = 'blank' | 'house2' | 'studio' | 'house-premium' | 'predio10';

export const TEMPLATES: Array<{ id: TemplateId; name: string; description: string; area: string }> = [
  { id: 'blank', name: 'Em branco', description: 'Dois níveis e os tipos de parede padrão.', area: '—' },
  { id: 'house2', name: 'Casa térrea, 2 quartos', description: 'Sala e cozinha integradas, banheiro e dois quartos.', area: '70 m²' },
  { id: 'house-premium', name: 'Casa de alto padrão, 2 pavimentos', description: 'Garagem, sala em L, cozinha, varanda gourmet, três suítes e home office.', area: '330 m²' },
  { id: 'predio10', name: 'Prédio, 10 pavimentos', description: 'Núcleo de circulação central e quatro unidades por andar; lajes e pisos param no núcleo.', area: '1.900 m²' },
  { id: 'studio', name: 'Quitinete', description: 'Ambiente único com banheiro, para testar rápido.', area: '27 m²' },
];

let seq = 0;
const wall = (a: [number, number], b: [number, number], typeId: string, id?: string): Omit<Wall, 'order'> =>
  makeWall({ id: id ?? `tw_${++seq}`, typeId, levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } });

const opening = (hostId: string, typeId: string, offset: number, kind: 'door' | 'window', extra: Partial<Opening> = {}): Opening => ({
  id: `to_${++seq}`,
  kind,
  typeId,
  hostId,
  offset,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
  ...extra,
});

/** Perímetro no sentido horário: a face externa fica à esquerda (docs/05 §3). */
function house2(cmds: Command[]): void {
  const EXT = 'wt_ext19';
  const IN = 'wt_alv9';
  const ws: Array<Omit<Wall, 'order'>> = [
    wall([0, 0], [0, 7], EXT, 'h_w'),
    wall([0, 7], [10, 7], EXT, 'h_n'),
    wall([10, 7], [10, 0], EXT, 'h_e'),
    wall([10, 0], [0, 0], EXT, 'h_s'),
    wall([4, 0], [4, 7], IN, 'h_i1'),
    wall([0, 3.5], [4, 3.5], IN, 'h_i2'),
    wall([4, 2.4], [10, 2.4], IN, 'h_i3'),
    wall([7, 0], [7, 2.4], IN, 'h_i4'),
  ];
  // Quinas externas em encosto, o padrão: pareia por face e não deixa o núcleo de uma parede aparecer na quina da
  // outra (docs/decisoes/0009 #11).
  const M = { ...DEFAULT_JOIN };
  const corner = (a: Omit<Wall, 'order'>, aEnd: 'joinStart' | 'joinEnd', b: Omit<Wall, 'order'>, bEnd: 'joinStart' | 'joinEnd') => {
    a[aEnd] = M;
    b[bEnd] = M;
  };
  const [hw, hn, he, hs] = ws as [Omit<Wall, 'order'>, Omit<Wall, 'order'>, Omit<Wall, 'order'>, Omit<Wall, 'order'>];
  corner(hw!, 'joinEnd', hn!, 'joinStart');
  corner(hn!, 'joinEnd', he!, 'joinStart');
  corner(he!, 'joinEnd', hs!, 'joinStart');
  corner(hs!, 'joinEnd', hw!, 'joinStart');
  for (const w of ws) cmds.push({ type: 'addWall', wall: w });
  const os: Opening[] = [
    opening('h_s', 'ot_p90', 4.5, 'door'),
    opening('h_i1', 'ot_p80', 5.3, 'door'),
    opening('h_i1', 'ot_p80', 1.7, 'door', { flipHand: true }),
    opening('h_i3', 'ot_p70', 4.5, 'door'),
    opening('h_n', 'ot_j120', 2.0, 'window'),
    opening('h_n', 'ot_j200', 6.0, 'window'),
    opening('h_n', 'ot_j150', 8.7, 'window'),
    opening('h_w', 'ot_j120', 1.7, 'window'),
    opening('h_w', 'ot_j120', 5.3, 'window'),
    opening('h_e', 'ot_j150', 2.6, 'window'),
    opening('h_e', 'ot_j60', 5.8, 'window'),
    opening('h_s', 'ot_j120', 8.0, 'window'),
  ];
  for (const o of os) cmds.push({ type: 'addOpening', opening: o });
}

function studio(cmds: Command[]): void {
  const EXT = 'wt_alv14';
  const ws: Array<Omit<Wall, 'order'>> = [
    wall([0, 0], [0, 5], EXT, 's_w'),
    wall([0, 5], [6, 5], EXT, 's_n'),
    wall([6, 5], [6, 0], EXT, 's_e'),
    wall([6, 0], [0, 0], EXT, 's_s'),
    wall([4, 0], [4, 2.2], 'wt_alv9', 's_i1'),
    wall([4, 2.2], [6, 2.2], 'wt_alv9', 's_i2'),
  ];
  // Quinas externas em encosto, como na casa (decisão 0009 #11).
  const M = { ...DEFAULT_JOIN };
  const [sw, sn, se, ss] = ws as [Omit<Wall, 'order'>, Omit<Wall, 'order'>, Omit<Wall, 'order'>, Omit<Wall, 'order'>];
  sw!.joinEnd = M; sn!.joinStart = M;
  sn!.joinEnd = M; se!.joinStart = M;
  se!.joinEnd = M; ss!.joinStart = M;
  ss!.joinEnd = M; sw!.joinStart = M;
  // Quina interna (divisória com a parede do banheiro encontra a parede da sala).
  const [si1, si2] = ws.slice(4) as [Omit<Wall, 'order'>, Omit<Wall, 'order'>];
  si1!.joinEnd = M; si2!.joinStart = M;
  for (const w of ws) cmds.push({ type: 'addWall', wall: w });
  const os: Opening[] = [
    opening('s_s', 'ot_p90', 4.2, 'door'),
    opening('s_i2', 'ot_p70', 1.0, 'door'),
    opening('s_n', 'ot_j200', 3.0, 'window'),
    opening('s_w', 'ot_j120', 2.5, 'window'),
    opening('s_e', 'ot_j60', 4.8, 'window'),
  ];
  for (const o of os) cmds.push({ type: 'addOpening', opening: o });
}

export function buildTemplate(id: TemplateId): Project {
  const store = new ProjectStore(createEmptyProject(id === 'blank' ? 'Projeto sem título' : TEMPLATES.find((t) => t.id === id)!.name));
  const cmds: Command[] = [];
  if (id === 'house2') house2(cmds);
  if (id === 'studio') studio(cmds);
  if (id === 'house-premium') casaAltoPadrao(cmds);
  if (id === 'predio10') predio10(cmds);
  for (const c of cmds) store.exec(c);
  const p = store.project;
  return p;
}
