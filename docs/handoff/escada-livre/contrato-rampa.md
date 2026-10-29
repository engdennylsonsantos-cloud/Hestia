# Contrato técnico do elemento RAMPA (Hestia)

Base: branch `feat/escada-calculo` (monorepo TypeScript). Este contrato é a fonte única de nomes. As tarefas `tarefa-rampa-1..5` repetem o essencial, mas em caso de dúvida vale este arquivo.

## 0. Decisões fechadas (não reabrir)

1. A rampa é um elemento SEPARADO (`kind: 'ramp'`) com tipo próprio (`RampType`), mas reaproveita o motor de lance e patamar da escada: os componentes são os mesmos `StairRun` e `StairLanding` (croqui), os geradores reta/L/U, a abertura de laje (`headroom`/`full`/`none`) e o corpo monolítico de face lisa.
2. A altura vem dos níveis (base/topo + deslocamentos). A inclinação é RESULTADO. O 2º clique define o comprimento. Dois modos: `length` (comprimento → inclinação) e `slope` (inclinação → comprimento). No modo `slope`, a rampa termina antes do clique se o clique passar do necessário (como a escada).
3. Limites de norma só geram AVISO. Nunca bloqueiam. A tabela de norma é EDITÁVEL no tipo e vem marcada "a conferir" (`normChecked: false`). Os valores vêm de fonte secundária (Sienge, citando a NBR 9050) e da fonte primária do ADA (Access Board).
4. A planta mostra seta de subida e o texto de inclinação em % e 1:X. A cota de corte segue o intervalo de vista.
5. O patamar conta no comprimento do percurso e não tem degraus.
6. O botão "Rampa" do ribbon (hoje `soon(t('Rampa', 'Ramp'), 'ramp')` em `apps/web/src/ui/ribbon/tabsMain.ts`) passa a ativar a ferramenta `ramp`.

Decisões de arquiteto tomadas neste contrato (derivadas, podem ser vistas na revisão):

- A. A rampa usa a MESMA categoria gráfica `stair` (visibilidade, espessuras de linha, "ocultar por categoria"). Não se cria `GraphicsCategory` nova, para não exigir migração dos overrides de todas as vistas. O rótulo da categoria em `packages/model/src/graphics.ts` muda de `escada` para `escada e rampa`. Separar a categoria fica como pendência futura.
- B. Cada lance da rampa é um `StairRun` com EXATAMENTE 2 linhas de espelho (a borda de início e a borda de fim do lance). O "piso" único entre elas é o lance inteiro. Assim `stairRunSteps` devolve 1 polígono = o lance, e as cotas z são interpoladas pelo comprimento.
- C. Inclinação uniforme: o desnível total H = topZ − baseZ é distribuído entre os lances na proporção do comprimento horizontal de cada um. Patamar é plano. `slope = H ÷ (soma dos comprimentos dos lances)`.
- D. Inclinação é guardada como FRAÇÃO (0,0833 = 8,33 %). Nunca em %. A UI converte.
- E. Sem alças (grips) de croqui na v1. A rampa se move, copia, gira, espelha, apaga e se edita pelas propriedades (largura, inclinação alvo, comprimento).
- F. Fora de escopo na v1: rampa curva/espiral, guarda-corpo, corrimão, guia de balizamento, transições de topo/base, regra de patamar a cada 50 m (NBR 9050, só fonte secundária), rampa de garagem com várias inclinações, L/U com mais de 2 lances.

## 1. Modelo (packages/model/src)

### 1.1 Tipos (arquivo novo `rampTypes.ts`; re-exportar em `types.ts` e `index.ts`)

```ts
import type { Id } from './types.ts';
import type { StairLanding, StairRun, StairOpeningMode } from './stairTypes.ts';

/** Forma: reta (n lances em linha, patamares no meio), em L (2 lances, giro de 90°) ou em U (2 lances, giro de 180°). */
export type RampShape = 'straight' | 'lshape' | 'ushape';
/** Modo de entrada usado na criação: 'length' = o comprimento manda e a inclinação sai; 'slope' = a inclinação manda e o comprimento sai. */
export type RampInputMode = 'length' | 'slope';
export type RampNormProfile = 'nbr9050' | 'ada' | 'custom';

/** Uma linha da tabela de norma: até `maxSlope` (fração), cada lance vence no máximo `maxRise` (m); no máximo `maxFlights` lances (null = sem limite). */
export interface RampNormRow {
  maxSlope: number;
  maxRise: number;
  maxFlights: number | null;
}

export interface RampType {
  id: Id;
  name: string;
  code: string;
  description: string;
  materialId: Id;
  /** Espessura estrutural do lance, PERPENDICULAR à rampa (m). */
  structuralDepth: number;
  /** Espessura do patamar (m). */
  landingThickness: number;
  /** Largura sugerida pela ferramenta (m). */
  defaultWidth: number;
  /** Largura mínima do lance (m); abaixo dela, aviso. */
  minWidth: number;
  /** Inclinação sugerida no modo 'slope' (fração). */
  defaultSlope: number;
  /** Menor dimensão mínima do patamar (m); abaixo dela, aviso. Também é o comprimento do patamar gerado em linha. */
  landingMinLength: number;
  /** Pé-direito livre mínimo para o furo da laje no modo 'headroom' (m). */
  minHeadroom: number;
  normProfile: RampNormProfile;
  /** false = "a conferir": as mensagens de norma acrescentam "(norma a conferir)". */
  normChecked: boolean;
  /** Tabela de norma, em ordem CRESCENTE de maxSlope. Vazia = sem verificação de norma. */
  normTable: RampNormRow[];
  /** Custo informativo (R$). */
  cost: number;
}

export interface Ramp {
  id: Id;
  kind: 'ramp';
  levelId: Id;
  typeId: Id;
  /** Nível de topo explícito; null = o nível imediatamente acima. */
  topLevelId: Id | null;
  baseOffset: number;
  topOffset: number;
  /** Altura usada só quando não há nível acima e o topo não é explícito. */
  height: number;
  /** Lance, patamar, lance... Cada lance tem EXATAMENTE 2 linhas de espelho (borda de início e de fim). */
  components: Array<StairRun | StairLanding>;
  shape: RampShape;
  /** Lado do giro (L e U), visto de quem sobe. Espelhar a rampa inverte este campo. */
  turn: 'left' | 'right';
  /** Profundidade do patamar de giro (L e U), em m. Em 'straight' é ignorado. */
  landingDepth: number;
  /** Modo de entrada da criação. */
  inputMode: RampInputMode;
  /** Inclinação alvo (fração) quando inputMode === 'slope'; null no modo 'length'. */
  slopeTarget: number | null;
  /** Abertura da laje do nível de topo: mesmos campos e regras da escada. */
  openingMode: StairOpeningMode;
  openingHeadroom: number | null;
  openingMargin: number;
  openingRect: boolean;
  mark: string;
  comments: string;
  order: number;
}
```

### 1.2 Constantes, fábrica e tipos iniciais (arquivo novo `ramp.ts`; `export *` em `index.ts`)

```ts
export const defaultRampTypeId: Id = 'rmt_nbr9050';
export const DEFAULT_RAMP_SLOPE = 1 / 12;            // 8,33 % (1:12)
export const RAMP_SLOPE_EPS = 1e-6;                  // tolerância ao comparar inclinações
export const DEFAULT_RAMP_NORM_NBR9050: RampNormRow[] = [
  { maxSlope: 0.05,   maxRise: 1.5, maxFlights: null }, // 5 %    (1:20)   até 1,50 m por lance
  { maxSlope: 0.0625, maxRise: 1.0, maxFlights: null }, // 6,25 % (1:16)   até 1,00 m por lance
  { maxSlope: 1 / 12, maxRise: 0.8, maxFlights: 15 },   // 8,33 % (1:12)   até 0,80 m por lance, até 15 lances
];
export const DEFAULT_RAMP_NORM_ADA: RampNormRow[] = [
  { maxSlope: 1 / 12, maxRise: 0.762, maxFlights: null }, // 1:12, 30 in por lance
];
export function makeRamp(r: { id: Id; typeId: Id; levelId: Id } & Partial<Omit<Ramp, 'order' | 'kind'>>): Omit<Ramp, 'order'>;
export const DEFAULT_RAMP_TYPES: RampType[];
export function rampTypeIssue(t: RampType): string | null;                       // 1ª mensagem de erro do tipo, ou null
export function rampMaxSlope(t: Pick<RampType, 'normTable'>): number | null;      // maior maxSlope da tabela; null se vazia
export function rampNormRowFor(t: Pick<RampType, 'normTable'>, slope: number): RampNormRow | null; // 1ª linha (crescente) com slope <= maxSlope + RAMP_SLOPE_EPS; null se passa de todas
/** Texto da inclinação, em pt-BR. `formatRampPercent(1/12)` = `8,33 %`; `formatRampRatio(1/12)` = `1:12`; `formatRampRatio(0.075)` = `1:13,3`; `formatRampSlope(1/12)` = `8,33 % (1:12)`; `formatRampSlope(0.05)` = `5,00 % (1:20)`. Percentual com 2 casas; razão com 1 casa, sem `,0` no fim; inclinação <= 0 → razão `—`. */
export function formatRampPercent(slope: number): string;
export function formatRampRatio(slope: number): string;
export function formatRampSlope(slope: number): string;
```

`makeRamp` padrões: `topLevelId: null`, `baseOffset: 0`, `topOffset: 0`, `height: 0.8`, `components: []`, `shape: 'straight'`, `turn: 'left'`, `landingDepth: 1.2`, `inputMode: 'length'`, `slopeTarget: null`, `openingMode: 'headroom'`, `openingHeadroom: null`, `openingMargin: DEFAULT_STAIR_OPENING_MARGIN`, `openingRect: false`, `mark: ''`, `comments: ''`.

`DEFAULT_RAMP_TYPES` (2 tipos):

| campo | `rmt_nbr9050` | `rmt_ada` |
|---|---|---|
| name | `Rampa de concreto (NBR 9050)` | `Rampa de concreto (ADA)` |
| code | `RP-01` | `RP-02` |
| description | `Rampa monolítica de concreto, face lisa, limites da NBR 9050 (a conferir)` | `Rampa monolítica de concreto, limites do ADA (1:12, 30 in por lance)` |
| materialId | `mat_concreto` | `mat_concreto` |
| structuralDepth | 0.15 | 0.15 |
| landingThickness | 0.15 | 0.15 |
| defaultWidth | 1.5 | 1.2 |
| minWidth | 1.2 | 0.915 |
| defaultSlope | 1/12 | 1/12 |
| landingMinLength | 1.2 | 1.525 |
| minHeadroom | 2.1 | 2.1 |
| normProfile | `nbr9050` | `ada` |
| normChecked | false | true |
| normTable | NBR (acima) | ADA (acima) |
| cost | 0 | 0 |

`rampTypeIssue(t)` (mensagens pt-BR): `defaultSlope` não positivo → `A inclinação padrão deve ser maior que zero.`; `structuralDepth`, `landingThickness`, `defaultWidth`, `minWidth`, `landingMinLength`, `minHeadroom` não positivos → `A espessura estrutural deve ser maior que zero.` etc. (uma mensagem por campo); `normTable` fora de ordem crescente de `maxSlope`, ou linha com `maxSlope <= 0` ou `maxRise <= 0` → `A tabela de norma deve estar em ordem crescente de inclinação, com valores positivos.`; `maxFlights` que não seja null nem inteiro ≥ 1 → `O máximo de lances deve ser vazio ou um inteiro positivo.`

### 1.3 Integração no modelo (editar)

| Arquivo | Mudança |
|---|---|
| `types.ts` | `Element` ganha `Ramp`; `Project` ganha `rampTypes: Record<Id, RampType>`; `export const isRamp = (e: Element \| undefined): e is Ramp => e?.kind === 'ramp';`; `SCHEMA_VERSION` sobe 1 (hoje 20 → 21; conferir o valor no momento) |
| `defaults.ts` | projeto novo traz `rampTypes: toRecord(DEFAULT_RAMP_TYPES)` |
| `migrate.ts` | nova migração `20: (raw) => ({ ...raw, rampTypes: { ...Object.fromEntries(DEFAULT_RAMP_TYPES.map(t => [t.id, t])), ...((raw.rampTypes as object) ?? {}) } })`. Projeto antigo ganha os 2 tipos e nenhuma rampa. (Se `SCHEMA_VERSION` já for outro número, use a chave = versão antiga.) |
| `commands.ts` | `{ type: 'addRamp'; ramp: Omit<Ramp, 'order'> }`, `{ type: 'upsertRampType'; rampType: RampType }`, `{ type: 'deleteRampType'; id: Id }`; `updateElements.patch` aceita `Partial<Ramp>`; transformação (`transformEach(p, c, isRamp, transformRamp)`); excluir nível em uso considera `isRamp(e) && (e.levelId === c.id \|\| e.topLevelId === c.id)` |
| comandos (regras) | `addRamp`: lança `Tipo de rampa inexistente` se o tipo não existe; `order = p.nextOrder++`. `upsertRampType`: lança a mensagem de `rampTypeIssue` se houver. `deleteRampType`: lança `Tipo em uso` se alguma rampa o usa; lança `O projeto precisa de ao menos um tipo de rampa` se for o último |
| `queries.ts` | `rampTopLevel(p, r)`, `rampBaseZ(p, r)`, `rampTopZ(p, r)`, `ramps(p)` (ordenadas por `order`), `rampsOnLevel(p, levelId)`, `rampTypeUsage(p, typeId)`; mesma lógica das `stair*` |
| `elementLevel.ts` | `hasLevel` inclui `isRamp`; ao mover nível, `baseOffset += delta` como a escada |
| `validateRamps.ts` (novo) | `rampIssues(p): ValidationIssue[]` com erros `ramp-type-missing`, `ramp-level-missing`, `ramp-top-level-missing`, `ramp-top-not-above` (mesmas regras de `validateStairs.ts`, usando `STAIR_MIN_HEIGHT`). Chamar de dentro de `validateProject` junto de `stairIssues` |
| `rampTransform.ts` (novo) | `transformRamp(r: Ramp, t: Transform): Ramp` = mapeia os componentes com a mesma função da escada (exportar `mapStairComponent` de `stairTransform.ts`); em `mirror`, inverte `turn` (`left` ↔ `right`) |
| `graphics.ts` | só o rótulo `stair: 'escada e rampa'` |
| `templateCasaAltoPadrao.ts` | não mexer |

Ids: `newId('rp')` para rampa; `newId('rn')` para componentes é desnecessário (os componentes usam `id` fornecido pelo gerador do app, igual à escada; copie como `stairFromGenerator` faz).

## 2. Motor (packages/engine/src)

### 2.1 Planejamento puro: `rampPlan.ts`

```ts
export interface RampPlanInput {
  start: Vec2;                 // centro da borda de início (1º clique)
  dir: Vec2;                   // direção de subida (não precisa ser unitária)
  H: number;                   // desnível total (m)
  type: RampType;
  shape: RampShape;
  turn: 'left' | 'right';
  width: number;               // largura do lance (m)
  landingDepth?: number;       // L/U; padrão max(width, type.landingMinLength)
  mode: RampInputMode;
  length?: number;             // modo 'length': comprimento TOTAL do percurso (m): soma dos lances + patamares
  slope?: number;              // modo 'slope': inclinação alvo (fração); ausente = type.defaultSlope
}
export interface RampPlan {
  parts: StairComponentSketch[];   // tipo já existente em stairGenerators.ts; cada lance com generatedBy = shape
  flights: number;                 // nº de lances
  flightLengths: number[];         // comprimento horizontal de cada lance (m)
  rises: number[];                 // desnível de cada lance (m)
  landingDepth: number;            // comprimento do patamar gerado (m)
  slope: number;                   // fração
  pathLength: number;              // soma dos lances + patamares
  note?: string;                   // explicação em pt-BR (ver §2.1.3)
}
export type RampPlanResult = RampPlan | { error: string };
export function planRamp(i: RampPlanInput): RampPlanResult;
```

#### 2.1.1 Fórmulas (todas em m; `P` = comprimento do patamar)

- `P` (reta) = `type.landingMinLength`. `D` (L/U) = `landingDepth ?? max(width, type.landingMinLength)`; em L exige `D >= width`.
- `rise_i = H × L_i ÷ ΣL`. Com lances iguais, `rise_i = H ÷ n`.
- Comprimento de um lance sem patamar: `L = H ÷ slope`.
- Pela norma, desnível máximo por lance: `maxRise = rampNormRowFor(type, slope)?.maxRise`.
- Número de lances (modo `slope`, reta): `n = ceil(H ÷ maxRise − 1e-9)`, mínimo 1. Se a inclinação passa de todas as linhas da tabela (`rampNormRowFor` = null) ou a tabela está vazia, use `maxRise` da ÚLTIMA linha (tabela vazia → `n = 1`) e o aviso de norma sai depois no motor.
- Modo `slope`, reta: `ΣL = H ÷ slope`; `L_i = ΣL ÷ n`; `pathLength = ΣL + (n−1)·P`.
- Modo `slope`, L/U: `n = 2` (fixo); `L_i = (H ÷ slope) ÷ 2`; `pathLength = ΣL + D`.
- Modo `length`, reta: com o comprimento total `Dc` dado, procure o MENOR `n` de 1 a 30 tal que `ΣL = Dc − (n−1)·P > 0` e, com `s = H ÷ ΣL`, `row = rampNormRowFor(type, s)` existe e `H ÷ n <= row.maxRise + 1e-9`. Se nenhum `n` servir, use `n = 1` (`ΣL = Dc`, `s = H ÷ Dc`) e deixe o aviso de norma sair no motor. Se `Dc <= 0`: erro. Tabela vazia: `n = 1`.
- Modo `length`, L/U: `n = 2`, `ΣL = Dc − D`; se `ΣL <= 0`: erro `O comprimento é curto demais para o patamar de giro.`; `s = H ÷ ΣL`; `L_i = ΣL ÷ 2`.
- `slope` do plano = `H ÷ ΣL`.
- Modo `slope`: `note` quando o comprimento digitado/clicado difere do necessário (o `planRamp` não conhece o clique; a ferramenta monta a nota, ver §4). `planRamp` só devolve `note` vazio.

Exemplos numéricos obrigatórios (viram testes de `rampPlan.test.ts`; tipo `rmt_nbr9050`, largura 1,5):

| # | Entrada | Resultado |
|---|---|---|
| 1 | reta, modo `slope`, H=0,80, slope=1/12 | n=1; L=[9,60]; rises=[0,80]; pathLength=9,60; slope=1/12 |
| 2 | reta, modo `slope`, H=1,20, slope=1/12 | maxRise=0,80 → n=2; ΣL=14,40; L=[7,20; 7,20]; rises=[0,60; 0,60]; patamar 1,20; pathLength=15,60 |
| 3 | reta, modo `slope`, H=3,00, slope=0,05 | maxRise=1,50 → n=2; ΣL=60; L=[30; 30]; pathLength=61,20 |
| 4 | reta, modo `length`, H=1,20, Dc=16,00 | n=1 reprova (s=0,075, maxRise 0,80, H÷1=1,20); n=2: ΣL=14,80, s=0,08108 ≤ 1/12, H÷2=0,60 ≤ 0,80 → n=2; L=[7,40; 7,40]; slope≈0,08108 |
| 5 | reta, modo `length`, H=0,80, Dc=8,00 | s=0,10 > 1/12; nenhum n serve → n=1; ΣL=8,00; slope=0,10 (o aviso de norma sai no motor) |
| 6 | L, modo `slope`, H=1,20, slope=1/12, D padrão=1,50 | n=2; ΣL=14,40; L=[7,20; 7,20]; pathLength=15,90 |
| 7 | reta, modo `length`, H=0 ou largura 0 | `{ error }` |

Mensagens de erro de `planRamp` (exatas): `A largura da rampa deve ser positiva.` · `O desnível deve ser positivo: nada a gerar.` · `A inclinação deve ser maior que zero.` · `O comprimento deve ser positivo.` · `O comprimento é curto demais para o patamar de giro.` · `O patamar da rampa em L deve ter profundidade ≥ largura do lance.`

#### 2.1.2 Geração (componentes)

- Reta: para o lance k (k = 0..n−1) começando em `u_k = Σ_{j<k}(L_j + P)`: `generateStraightRun({ start: start + d·u_k, dir: d, width, risers: 2, tread: L_k })` (isto é, 2 linhas de espelho separadas por `L_k`). Entre os lances k e k+1, um patamar retangular: u de `u_k + L_k` a `u_k + L_k + P`, v de −width/2 a +width/2 (v à esquerda, `n = perp(d)`), contorno com 4 retas fechadas (mesmo desenho do `landing()` privado de `stairGenerators.ts`; copie para dentro de `rampPlan.ts`, não exporte o privado).
- L: `generateLShape({ start, dir, width, risersFirst: 2, risersSecond: 2, tread: L_i, turn, landingDepth: D })`. U: `generateUShape` com os mesmos campos. Lances iguais, então um único `tread` serve.
- Cada lance recebe `generatedBy: shape` (`'straight' | 'lshape' | 'ushape'`, valores já existentes em `StairGenerator`).

#### 2.1.3 Base de regeneração: `rampBasis(r: Ramp): { start: Vec2; dir: Vec2; width: number } | null`

Lê o 1º componente (deve ser lance com 2 espelhos): `start` = ponto médio do 1º espelho (`mid(a, b)`), `dir` = unitário de (ponto médio do 2º espelho − ponto médio do 1º), `width` = `dist(a, b)` do 1º espelho. Null se a geometria é inválida. Usado por quem regenera a rampa (propriedades e ferramenta).

### 2.2 Resolução: `ramps.ts`

```ts
export interface ResolvedRampFlight {
  componentIndex: number;
  polygon: Ring;                 // planta do lance
  start: Vec2; end: Vec2;        // centro da borda de início e de fim
  startEdge: [Vec2, Vec2]; endEdge: [Vec2, Vec2];
  width: number;                 // dist(startEdge)
  length: number;                // horizontal: dist(start, end)
  z0: number; z1: number;        // cotas absolutas no início e no fim
  slope: number;                 // (z1 - z0) / length
}
export interface ResolvedRampLanding { componentIndex: number; polygon: Ring; z: number; minDim: number }
/** Fatia de ~10 cm do lance (ou o patamar inteiro) com a cota z do ponto MAIS ALTO dela; serve ao furo por 'headroom' e ao símbolo de corte da planta. */
export interface RampSlice { componentIndex: number; kind: 'flight' | 'landing'; polygon: Ring; z: number }
export interface ResolvedRamp {
  id: Id; levelId: Id; topLevelId: Id | null; typeId: Id; type: RampType;
  baseZ: number; topZ: number; rise: number;     // rise = topZ - baseZ
  flights: ResolvedRampFlight[]; landings: ResolvedRampLanding[];
  slices: RampSlice[];
  flightsLength: number;         // soma dos comprimentos dos lances
  pathLength: number;            // flightsLength + soma das minDim dos patamares
  slope: number;                 // rise / flightsLength; 0 sem lances
  footprint: MultiPolygon;       // união de lances e patamares
  issues: RampIssueItem[];
}
export interface RampIssueItem { code: string; severity: 'error' | 'warning'; message: string; rampId: string; componentIndex?: number; ids?: string[] }
export const RAMP_SLICE_LENGTH = 0.10;   // m
export function resolveRamps(p: Project): ResolvedRamp[];
export function resolveRampsOnLevel(p: Project, levelId: Id): ResolvedRamp[];
```

Algoritmo de `resolveOne(p, r)` (retorna null se o tipo não existe):

1. `baseZ = rampBaseZ`, `topZ = rampTopZ`, `H = topZ − baseZ`. Se `H <= STAIR_MIN_HEIGHT` (0,001): sem peças (o modelo já acusa `ramp-top-not-above`).
2. Para cada componente `run`: exige `risers.length === 2`; senão erro `ramp-run-edges` (`O lance da rampa deve ter exatamente 2 linhas de borda.`). Calcule `L_i` (distância entre os pontos médios dos dois espelhos, em ordem de caminhada, via `stairRunSteps` com `riserHeight` provisório ou direto da geometria). Some `ΣL`. Se `ΣL <= 0`: erro `ramp-empty` (`A rampa não tem lances.`).
3. Cursor `z = baseZ`. Para cada componente em ordem: lance → `rise_i = H × L_i ÷ ΣL`; `stairRunSteps(run, { baseZ: z, riserHeight: rise_i })` (erros de croqui viram `RampIssueItem` com o código do croqui, como `sketchIssues` da escada); `polygon = treads[0].polygon`; `z0 = z`, `z1 = z + rise_i`; `z += rise_i`. Patamar → `stairLandingPolygon`; `z` do patamar = `z` atual; `minDim = minWidth(ring)` (de `stairIssues.ts`).
4. Fatias do lance: `k = max(2, ceil(L_i ÷ RAMP_SLICE_LENGTH) + 1)` linhas; `distributeRisers(run, k)` → novo croqui do lance com `k` espelhos; `stairRunSteps(novo, { baseZ: z0, riserHeight: rise_i ÷ (k−1) })`; cada `tread` vira `RampSlice { kind: 'flight', polygon, z: tread.z }`. Máximo de 400 fatias por lance (acima disso aumente o passo). Cada patamar vira 1 fatia `kind: 'landing'` com `z` do patamar.
5. `slope = H ÷ flightsLength`; `footprint = union(todos os polígonos)`.
6. `issues` = erros acima + `rampNormIssues(rr)` (§2.3).

Ordem de componentes: respeitada tal como gravada. `ResolvedRamp.slope` e `flights[i].slope` são iguais (inclinação uniforme).

### 2.3 Avisos de norma: `rampIssues.ts`

`rampNormIssues(rr: ResolvedRamp): RampIssueItem[]` — todos `severity: 'warning'`. Sufixo ` (norma a conferir)` em TODA mensagem de norma quando `!rr.type.normChecked`. Formatação: `pct(s)` = `formatRampPercent(s)` (ex.: `8,33 %`); `ratio(s)` = `formatRampRatio(s)` (ex.: `1:12`, `1:12,3`); metros com 2 casas e vírgula.

| code | Condição | Mensagem (pt-BR) |
|---|---|---|
| `ramp-slope-over-norm` | tabela não vazia e `rampNormRowFor(type, slope) === null` | `A inclinação de {pct} ({ratio}) passa do máximo do tipo ({pctMax} / {ratioMax}).` |
| `ramp-flight-rise-over-norm` | por lance: `row = rampNormRowFor(type, slope)` existe e `rise_i > row.maxRise + 1e-6`. (Se `row` é null, use a ÚLTIMA linha da tabela.) | `O lance {i} vence {rise} m; para {pct} o máximo por lance é {maxRise} m.` (`i` = ordem do lance, de 1) |
| `ramp-flights-over-norm` | `row.maxFlights !== null` e nº de lances > `row.maxFlights` | `A rampa tem {n} lances; para {pct} o máximo é {maxFlights}.` |
| `ramp-landing-short` | por patamar: `minDim < type.landingMinLength - 1e-6` | `O patamar {i} mede {minDim} m; o mínimo do tipo é {landingMinLength} m.` |
| `ramp-width-min` | por lance: `width < type.minWidth - 1e-6` | `O lance {i} tem {width} m de largura; o mínimo do tipo é {minWidth} m.` |
| `ramp-slope-differs` | `ramp.inputMode === 'slope'` e `slopeTarget !== null` e `abs(slope − slopeTarget) > 0.0005` (precisa do `Ramp`: calcular em `resolveOne`, que tem o `Ramp`) | `A inclinação resultante ({pct}) difere da alvo ({pctAlvo}); regenere a rampa.` |
| `ramp-no-landing` | mais de 1 lance e dois lances consecutivos SEM patamar entre eles (componentes `run, run`) | `Há lances consecutivos sem patamar entre eles.` (sem sufixo de norma) |

Erros (severity `error`, sem sufixo): `ramp-run-edges`, `ramp-empty`, mais os códigos de croqui (`stair-*` vindos de `stairRunSteps`/`stairLandingPolygon`).

Funções públicas: `rampIssueList(p: Project): RampIssueItem[]` (de todas as rampas; inclui o aviso `ramp-headroom` ABAIXO) e `rampValidationIssues(p): ValidationIssue[]` (mesmo formato do painel: `{ severity, code, message, elementId: rampId, ids? }`), e `makeRampIssue(...)`.

`ramp-headroom` (warning): reaproveite `topCovers(p, levelId)` de `stairChecks.ts` (exportar `TopCover` já exportado). Para cada lance, o ponto mais alto sob uma cobertura: folga = `coverBottomZ − z` onde a rampa e a cobertura se sobrepõem em planta; se `folga < type.minHeadroom` → `Folga de cabeça de {folga} m menor que a mínima do tipo ({minHeadroom} m) sob a laje.` Se a implementação ficar complicada, aceitável na v1 usar apenas as fatias: para cada fatia cuja `polygon` intersecta uma cobertura (`intersection`), folga = `cover.bottomZ − slice.z`. Ver `stairHeadroomIssue` como modelo.

### 2.4 Abertura da laje: `rampOpenings.ts` + `levelOpenings.ts`

- Exportar (só acrescentar `export`) `closeWells` e `trimBeyondTop` de `stairOpenings.ts`; `StairArrivalFrame` já é exportado de `stairBody.ts`.
- `rampOpenings.ts`:
  - `rampHoleRegion(rr, undersideZ, headroom = rr.type.minHeadroom): MultiPolygon` = união das fatias com `slice.z >= undersideZ − headroom − 1e-9` (como `stairHoleRegion`).
  - `rampArrivalFrame(rr): StairArrivalFrame | null` = último lance: `a, b` = `endEdge`, `u` = unitário de `end − start`, `length` 0,3.
  - `rampOpeningRegion(r: Ramp, rr: ResolvedRamp, undersideZ): MultiPolygon` — mesma sequência de `stairOpeningRegion` sem caracol: `none` → `[]`; `full` → `rr.footprint`; `headroom` → `rampHoleRegion(rr, undersideZ, r.openingHeadroom ?? rr.type.minHeadroom)`; região vazia → `[]`; `closeWells`; se `openingMargin > 0`: `offsetMulti` + `trimBeyondTop(region, rampArrivalFrame(rr), openingMargin + 0.01)`; se `openingRect`: `minAreaRect`.
  - `rampOpeningsOnLevel(p, levelId): RampOpening[]` (`{ ramp, resolved }`, rampas com `openingMode !== 'none'` e nível de topo = `levelId`).
  - `rampHolesFor(openings: RampOpening[], undersideZ): MultiPolygon`.
- `levelOpenings.ts` (novo, para não editar 3 vezes a lógica): `export interface LevelOpenings { stairs: StairOpening[]; ramps: RampOpening[] }`, `openingsOnLevel(p, levelId): LevelOpenings`, `holesFor(o: LevelOpenings, undersideZ): MultiPolygon` (união de `stairHolesFor` e `rampHolesFor`; vazio sem nada).
- Trocar em `floors.ts`, `slabs.ts` e `ceilings.ts` as chamadas `stairOpeningsOnLevel`/`stairHolesFor` por `openingsOnLevel`/`holesFor`. `ceilings.ts` guarda `{ stairs, shafts }`: renomear o campo para `openings: LevelOpenings` mantendo o resto. Manter `stairOpeningsOnLevel`/`stairHolesFor` exportados (testes existentes).
- Cache/invalidação: onde o motor lista elementos que afetam o furo (`junctionIndex.ts`: `isStair` nas linhas ~18 e ~61 e a lista `p.stairTypes` ~79), acrescentar `isRamp`, `rampsOnLevel` e `p.rampTypes`.

### 2.5 Corpo, quantitativos, tabela

`rampBody.ts`:

```ts
export interface RampPlane { a: number; b: number; c: number }   // z = a·x + b·y + c
export interface RampBodyPiece { kind: 'flight' | 'landing'; componentIndex: number; polygon: Ring; top: RampPlane; bottom: RampPlane }
export const planeZ = (pl: RampPlane, x: number, y: number): number => pl.a * x + pl.b * y + pl.c;
export function rampBody(rr: ResolvedRamp): { pieces: RampBodyPiece[] };   // sem peças se houver erro
export function rampPieceVolume(piece: RampBodyPiece): number;            // área × (topo − fundo no centróide); use ringMoments de stairBodyGeom.ts
```

- Lance: `d` = unitário de `end − start`; `s = slope`; topo: `a = s·d.x`, `b = s·d.y`, `c = z0 − s·(start·d)`. Fundo = topo − `structuralDepth ÷ cosθ`, com `cosθ = 1 ÷ sqrt(1 + s²)` (a espessura estrutural é PERPENDICULAR; a vertical é maior). Exemplo: s=1/12, t=0,15 → vertical 0,15 × sqrt(1+1/144) = 0,150519 m.
- Patamar: topo plano em `z`; fundo plano em `z − landingThickness`.

`rampQuantities.ts`:

```ts
export interface RampQuantities {
  rampId: Id; typeId: Id;
  flightCount: number; landingCount: number;
  slope: number;              // fração
  width: number;              // menor largura de lance (m)
  rise: number;               // m
  flightsLength: number;      // m
  pathLength: number;         // m
  planArea: number;           // m² (footprint)
  flightArea: number;         // m² planta dos lances
  landingArea: number;        // m² planta dos patamares
  surfaceArea: number;        // m²: lances × sqrt(1 + slope²) + patamares (área real da superfície)
  volumeFlights: number;      // m³
  volumeLandings: number;     // m³
  volume: number;
  volumeByMaterial: Record<Id, number>;   // tudo no materialId do tipo
}
export function rampQuantities(rr: ResolvedRamp): RampQuantities;   // erro de croqui => tudo zero
```

Volume do lance = `área em planta × structuralDepth × sqrt(1 + s²)`; do patamar = `área × landingThickness`.

Exemplo de aceite (retangular, rmt_nbr9050, largura 1,50, H=0,80, slope=1/12, 1 lance de 9,60 m): `flightArea = 14,40`; `surfaceArea = 14,40 × sqrt(1+1/144) = 14,4499`; `volumeFlights = 14,40 × 0,15 × 1,003466 = 2,16748`; `planArea = 14,40`; `volume ≈ 2,1675` (tolerância 1e-3).
Exemplo com patamar (H=1,20, 2 lances de 7,20 + patamar 1,20×1,50): `flightArea = 21,60`; `landingArea = 1,80`; `volumeLandings = 1,80 × 0,15 = 0,27`; `volumeFlights = 21,60 × 0,15 × 1,003466 = 3,25123`; `volume ≈ 3,5212`.

`rampSchedule.ts` (modelo: `stairSchedule.ts`): `RampScheduleRow { rampId, mark, typeId, typeName, typeCode, baseLevelId, baseLevelName, topLevelId, topLevelName, flightCount, slope, rise, pathLength, width, planArea, volume }`, `RampScheduleTotals { count, planArea, volume }`, `RampSchedule`, `buildRampSchedule(p)`, `filterRampRows`, `sumRampRows`, `rampScheduleToCsv` (cabeçalho pt-BR: `Marca;Tipo;Código;Nível base;Nível topo;Lances;Inclinação (%);Desnível (m);Comprimento (m);Largura (m);Área (m²);Volume (m³)`; inclinação em % com `formatDecimal`).

### 2.6 Categorias de vista

- `viewClass.ts`: `classOf`/categoria de um elemento `ramp` = `'stair'`; o intervalo de vista usa `rampBaseZ/rampTopZ` como `stairBaseZ/stairTopZ`; a lista de elementos do nível (`stairsOnLevel` na linha ~195) inclui `rampsOnLevel`. `extendBelow` para `'stair'` vale igual.
- `viewWarnings.ts`: sem mudança de tipo (a categoria é `stair`); o rótulo `['escada', 'escadas']` vira `['escada ou rampa', 'escadas e rampas']`.
- `index.ts` do engine: `export *` dos novos arquivos (`rampPlan`, `ramps`, `rampIssues`, `rampOpenings`, `levelOpenings`, `rampBody`, `rampQuantities`, `rampSchedule`).

### 2.7 Regeneração: `rampEdit.ts` (engine)

```ts
export interface RampRegenPatch { width?: number; mode?: RampInputMode; slope?: number; length?: number; landingDepth?: number }
export interface RampRegenResult { components: Array<StairRun | StairLanding>; inputMode: RampInputMode; slopeTarget: number | null; landingDepth: number }
export function regenRamp(ramp: Ramp, p: Project, patch: RampRegenPatch): RampRegenResult | { error: string };
```

Usa `rampBasis(ramp)` (start, dir, width), o tipo (`p.rampTypes[ramp.typeId]`), `H = rampTopZ − rampBaseZ` e `planRamp`, mantendo `ramp.shape` e `ramp.turn`. Regras: `mode` ausente = `ramp.inputMode`; modo `slope`: `slope` ausente = `ramp.slopeTarget ?? type.defaultSlope`; modo `length`: `length` ausente = o `pathLength` atual (soma dos lances e patamares da rampa resolvida); `width` ausente = a da base; `landingDepth` ausente = `ramp.landingDepth`. `slopeTarget` do resultado = a inclinação usada no modo `slope`, `null` no modo `length`. Erros do `planRamp` voltam em `{ error }`. Os ids dos componentes novos: reaproveitar os ids antigos pela ordem (lance/patamar de mesmo índice) e gerar `newId('rc')` para os que sobrarem. Quem grava (a UI) faz `updateElements` em UMA transação.

## 3. Ferramenta (packages/tools/src)

- `ToolId` ganha `'ramp'`; grupo "Construir" em `registry.ts` ganha `'ramp'` depois de `'stairrun'`; `createTool` `case 'ramp': return new RampTool(env);`; rótulo `ramp: 'Rampa'`. Atalho: perfil Revit `ramp: 'RA'` (livre); perfil simples: todas as teclas A–Z e 0–9 estão em uso; se o tipo `ShortcutMap` aceita ausência, omita no perfil simples; senão pergunte/registre a decisão no relatório.
- `types.ts`: `ToolOptions.ramp?: RampToolOptions`. A interface `RampToolOptions` e `DEFAULT_RAMP_OPTIONS` ficam em `rampOptions.ts` (Fase 1).

```ts
export interface RampToolOptions {
  typeId?: Id;                      // ausente/inexistente = defaultRampTypeId
  shape: RampShape;
  width?: number;                   // ausente = type.defaultWidth
  turn: 'left' | 'right';
  landingDepth?: number;            // L/U; ausente = max(largura, type.landingMinLength)
  mode: RampInputMode;
  slope?: number;                   // fração, modo 'slope'; ausente = type.defaultSlope
  topLevelId?: Id | null;
  baseOffset?: number;
  topOffset?: number;
  height?: number;
}
export const DEFAULT_RAMP_OPTIONS: RampToolOptions = { shape: 'straight', turn: 'left', mode: 'length' };
```

- Arquivos novos: `rampTool.ts` (classe `RampTool extends ToolBase`, `id = 'ramp'`, `label = 'Rampa'`), `rampCommands.ts`, `rampPick.ts`, `rampPreview.ts`; testes `rampTool.test.ts`, `rampPick.test.ts`. `rampOptions.ts` (tipos e padrão), o `'ramp'` em `ToolId` e um esqueleto de `RampTool` nascem na Fase 1 (para a interface da Fase 5 compilar sem esperar a Fase 2); a Fase 2 SUBSTITUI o esqueleto pela ferramenta completa.
- Fluxo de cliques (igual à escada):
  1. `start()` diz `Rampa: clique no centro da borda de início. Esc cancela.`
  2. 1º clique (com snap) fixa `origin`; mensagem `Rampa: clique para dar a direção e o comprimento, ou digite o ângulo em graus (0 = eixo X). Esc cancela o ponto.`
  3. Movimento: prévia (linhas dos componentes + polígonos de lance e patamar + rótulo no cursor `{pct} ({ratio}) · {n} lance(s) · {pathLength} m`). Erro de planejamento vai para a barra de status e a prévia mostra só o ponto.
  4. 2º clique: `dir = click − origin`; se `len(dir) < 0,01` → `Afaste o cursor do ponto inicial para dar a direção.` Modo `length`: `planRamp({ mode: 'length', length: len(dir) })`. Modo `slope`: `planRamp({ mode: 'slope', slope })` e nota (ver abaixo).
  5. Digitar um número (ângulo em graus): `dir = (cos, sin)`; como não há comprimento clicado, usa `planRamp` em modo `slope` com `options.slope ?? type.defaultSlope` e a nota `Sem clique de comprimento: usada a inclinação {pct}.`
  6. Criação: UMA transação `Criar rampa` com UM comando `addRamp`; seleciona a rampa; a ferramenta continua pronta; Esc sai.
- Notas do modo `slope` (comparando o comprimento clicado `click` com `plan.pathLength`): `click > pathLength + 0,005` → `A inclinação de {pct} pede {pathLength} m: a rampa termina antes do clique de {click} m.`; `click < pathLength − 0,005` → `A inclinação de {pct} pede {pathLength} m: a rampa passa do clique de {click} m.`
- Mensagem final: `Rampa criada: {n} lance(s), inclinação {pct} ({ratio}), {pathLength} m.{ nota}{ Aviso: primeira mensagem de aviso da rampa} Ctrl+Z desfaz.`
- Altura: do nível ativo e do nível acima. A rampa tem opções próprias de cota, em `RampToolOptions`: `topLevelId?: Id | null; baseOffset?: number; topOffset?: number; height?: number` (mesmos significados da escada; `height` só vale sem nível acima). Não reuse `ToolOptions.stair`.
- `rampCommands.ts`: `rampTypeId(p, want?)`, `draftRamp(p, opts, levelId): Ramp | null`, `rampRise(p, ramp)` (= `rampTopZ − rampBaseZ`), `createRampFromPlan(env, plan, input): { id: Id } | { error: string }`.
- `rampPick.ts`: `selectedRamps`, `rampPolylines`, `rampRings`, `pickRampAt`, `rampIdsInBox`, `rampSnapPoints`, `rampEndpoints`. Para não duplicar código, generalize os de `stairPick.ts` (parâmetro `{ components: Array<StairRun|StairLanding> }` em vez de `Stair`) e chame-os.
- Integração (arquivos a editar): `selectTool.ts` (`kind: 'ramp'`, `pickRampAt`, caixa de seleção, `isRamp` nos pontos de snap), `selectionFilters.ts` (`'ramps'` em `ElementCategory`, `isRamp` nos filtros de tipo), `clipboard.ts` (copiar/colar: campo `ramps`, comando `addRamp`), `edit.ts` (`selectedMovables`, ids novos `newId('rp')`, fantasma `ghostRampItems` em `rampPreview.ts`), `index.ts`, `types.ts`, `registry.ts`, `shortcutDefaults.ts`.

## 4. Planta, 3D e corte (packages/render/src, mais engine/sectionRamps.ts)

### 4.1 Planta: `plan/ramps.ts`

```ts
export const RAMP_CUT_HEIGHT = 1.2;   // m acima da base, quando não há intervalo de vista
export function rampFootprint(r: ResolvedRamp): MultiPolygon;           // = r.footprint
export const rampSlopeText: (slope: number) => string;                   // = formatRampSlope, "8,33 % (1:12)"
export function rampFills(p, ramps, theme, dark, detail, v, view?, paint = defaultPaint('stair', v.zoom), scale = 100): FloorOps;
export function belowRampOps(ramps: ResolvedRamp[], theme: PlanTheme): FloorOps;
export function rampSelectionOps(p, ramps, selection, hover, theme, v): FloorOps;
```

Regras de `rampFills` (copiar o espírito de `stairFills`):

- `cutZ = view?.cutZ ?? r.baseZ + RAMP_CUT_HEIGHT`. Rampa que começa acima de `view.topZ` não sai.
- Cor: `surfaceColor(material.color, fillBase, dark ? 0.42 : 0.74, paint)`, igual à escada.
- Grosseiro (`detail === 'coarse'`): só o preenchimento do `footprint` (partes com `z <= viewTop`).
- Médio e fino: cada fatia com `z <= cutZ + 1e-9` é "cortada": preenchimento cheio; os contornos de LANCE e PATAMAR (não das fatias) em traço contínuo (`projecao`). A parte do lance acima do corte: sem preenchimento forte — contorno tracejado (`STAIR_DASH`) e, se estiver dentro do intervalo de vista (`z <= viewTop`), preenchimento com `alpha: 0.35`. Acima de `viewTop`: só contorno tracejado.
- Linha de corte: por lance onde `z0 < cutZ < z1`, uma reta transversal na posição `t = (cutZ − z0) ÷ (z1 − z0)` (ponto = `start + (end − start)·t`, de borda a borda: `startEdge` e `endEdge` interpolados por `t`), traço `corte`, cor `theme.ink`.
- Seta de subida: por lance, a polilinha `start → end` (eixo do lance) com ponta de 7 px (marcador em pixels) no `end`, igual `climbArrow` da escada (função privada; copie ou exporte `climbArrow` de `plan/stairs.ts`, preferir exportar).
- Texto de inclinação: um `LabelOp` por lance, no ponto médio do eixo deslocado para o lado (`beside(u, STAIR_SOBE_OFFSET_MM, scale)`, como o "SOBE"), `fontMm 1.6`, texto `rampSlopeText(slope)`. Exemplo: `8,33 % (1:12)`. No primeiro lance, o texto `SOBE` não é usado (a seta basta).
- `showTags`: código do tipo no centróide do `footprint`.
- `rampSelectionOps`: `outlineSelectionOps(partes, ...)` com o `footprint`, igual `stairSelectionOps`.

Integração: `plan/resolucao.ts` (`rampasDoNivel`), `plan/build.ts` (chamar `belowRampOps` e `rampFills` ao lado das escadas; mesmo `paint.stair`), `plan/planContext.ts`, `plan/planOverlay.ts`, `plan/view.ts` (ids ocultos: `add('stair', r.id)` para rampas; `footprints.set(r.id, rampFootprint(r))`), `plan/tags.ts` (`e.kind === 'ramp' ? p.rampTypes[e.typeId]`).

### 4.2 3D: `model3d/rampSolids.ts`

`buildRampSolids(ramps: ResolvedRamp[]): SolidBatch[]` — um lote por material do tipo (`category: 'stair'`). Para cada rampa sem erro, para cada peça de `rampBody(rr).pieces`: `extrudeCaps(b, [piece.polygon], 0, 0, topAt, bottomAt)` com `topAt = (x, y) => planeZ(piece.top, x, y)` e `bottomAt = (x, y) => planeZ(piece.bottom, x, y)`; paredes: para cada aresta p→q do anel orientado anti-horário, `pushWall(b, p, q, bottomAt(p), bottomAt(q), topAt(p), topAt(q))`. Envolver em `ofElement(b, ramp.id, ...)`. Hook em `scene3d.ts` ao lado de `buildStairSolids` (`shown('stair')`), com `resolveRamps(p)` calculado uma vez. A chave de cache do nível (`chaveNivel3d.ts`) precisa incluir as rampas do nível e `p.rampTypes` onde hoje inclui escadas (buscar `stair`/`escada` nesse arquivo).

### 4.3 Corte: `engine/sectionRamps.ts`

`sectionOfRamps(ramps: ResolvedRamp[], line: SectionLine, p: Project): StairSection` (mesmo tipo de retorno de `sectionOfStairs`, com `rampId` no lugar de `stairId` na origem). Para cada peça de `rampBody`: `lineIntervals([piece.polygon], line.a, d, n)`; para cada intervalo `[lo, hi]` (aparado a `[0, length]`), polígono `[ {lo, zBot(lo)}, {hi, zBot(hi)}, {hi, zTop(hi)}, {lo, zTop(lo)} ]` com `zTop/zBot` pelo plano no ponto da linha em `t`. Além do plano (`beyond`): projeção convexa dos vértices (topo e fundo) como em `sectionOfStairs` (`convexHull` é privado de `sectionStairs.ts`: exportar). Material = `type.materialId`. Hook em `section.ts` ao lado de `sectionOfStairs` (`resolveRampsOnLevel`), e o mapeamento de origem em `render/src/section/pick.ts` (`['rampId', 'stair']`). Tipos de origem (`SectionOrigin`) ganham `rampId?: Id`.

## 5. IFC e DXF (packages/io + adaptadores em apps/web/src/editor)

IFC (`packages/io/src/ifc/`):

- `ifcTypes.ts`: `IfcRampGeo { rampId: Id; levelId: Id; shape: 'straight' | 'lshape' | 'ushape'; slope: number; flights: Array<{ componentIndex: number; prism: IfcPrism; length: number }>; landings: IfcPrism[] }`; `IfcGeometry.ramps: IfcRampGeo[]`.
- `ifcElements.ts`: `addRamps(c, geo)`, chamado em `ifcExport.ts` ao lado de `addStairs`. `IFCRAMP` (contido no pavimento de base): atributos `[gid('ramp:'+id), OMIT, nome, OMIT, OMIT, ref(place), OMIT, OMIT, en(predefined)]`; `predefined`: 1 lance reto `STRAIGHT_RUN_RAMP`; reta com 2 lances `TWO_STRAIGHT_RUN_RAMP`; L `QUARTER_TURN_RAMP`; U `HALF_TURN_RAMP`; senão `NOTDEFINED`. Por lance, um `IFCRAMPFLIGHT` com os mesmos 9 atributos (`PredefinedType` = `en('STRAIGHT')`), `Representation` = `prismsShape(c.w, c.ctx, [flight.prism], st.elev)`, nome `{tipo} - lance {i}`, agregado ao `IFCRAMP` com `IFCRELAGGREGATES`. Cada patamar: `slabEntity(c, st, 'landing:'+id+':'+i, nome, [prism], 'LANDING')` (`IFCSLAB` LANDING) contido no pavimento (mesmo que a escada).
- Prisma do lance: `polygon: [ring]`, `top`/`bottom` = os planos de `rampBody` (`{a,b,c}`); ver como `flatPlane` e `IfcPlane` são definidos.
- `apps/web/src/editor/ifcExport.ts`: `rampOf(p, rr)` (como `stairOf`) e `ramps: resolveRamps(p).map(...)` em `ifcGeometryOf`.

DXF (`packages/io/src/dxf.ts` + `apps/web/src/editor/dxfExport.ts`):

- Camadas novas: `RAMPA` (contornos até o corte, `cut('stair')`), `RAMPA_ACIMA` (tracejada, `projection('stair')`), `RAMPA_SETA` (annotation), `RAMPA_CORTE` (annotation), `RAMPA_TEXTO` (annotation). Constantes `DXF_LAYER_RAMP`, `DXF_LAYER_RAMP_ABOVE`, `DXF_LAYER_RAMP_ARROW`, `DXF_LAYER_RAMP_CUT`, `DXF_LAYER_RAMP_TEXT`; registrar nas tabelas de camada/estilo/papel (onde `DXF_LAYER_STAIR_*` aparecem: linhas ~146–157, ~261, ~302–309).
- `DxfLevelGeometry.ramps?: Array<{ outlines: DxfPoint[][]; outlinesAbove?: DxfPoint[][]; arrow: Array<[DxfPoint, DxfPoint]>; cut: Array<[DxfPoint, DxfPoint]>; texts: DxfNoteText[] }>`. `shapesOf`/`linesOf`/`textsOf` incluem. O texto (`DxfNoteText`: `at`, `text`, `height`, `rotation`, `layer`) é `rampSlopeText`, na camada `RAMPA_TEXTO`, `rotation` = ângulo do eixo do lance em graus.
- `dxfExport.ts`: `rampDxf(p, rr, { cutZ, topZ })` ao lado de `stairDxf`; `ramps: shown('stair') ? resolveRampsOnLevel(...)... : undefined`. A seta usa `stairArrow(a, b)` (já exportada) sobre o eixo de cada lance.

## 6. Interface (apps/web/src)

- **Estado** (`editor/state.ts`): `DialogKind` ganha `'rampType'` e `'rampSchedule'`; `ToolOptions` padrão ganha `ramp: DEFAULT_RAMP_OPTIONS`.
- **Ribbon**: `tabsMain.ts`: trocar `soon(t('Rampa', 'Ramp'), 'ramp')` por `tool('ramp', 'large', { label: t('Rampa', 'Ramp') })`; `ribbon/actions.ts`: `rampTypes` (abre `rampType` do 1º selecionado), `schedRamps`; `ribbon/context.ts`: aba contextual `ramp` com painéis Rampa (Tipos de rampa) e Tabela; `ribbon/model.ts` (ação nova no `ActionId`); `PLACE` e `toolSelection.ts` incluem `'ramp'`; `Icon.tsx`: ícone `ramp` (reutilize o estilo de `stairrun`: trapézio inclinado `M3 26L29 12V26Z` + seta).
- **Barra de opções** (`ui/RampOptionsBar.tsx`, novo; ligar em `OptionsBar.tsx`): Forma (Reta / Em L / Em U), Largura, Giro (L/U), Profundidade do patamar (L/U), Modo (`Comprimento → inclinação` / `Inclinação → comprimento`), Inclinação (%), só quando modo = inclinação; Tipo. Inclinação digitada em % (`NumField scale={100} unit="%"` guarda a fração). Mostrar ao lado: `1:{ratio}`.
- **Colocação** (`PlacementProperties.tsx`): grupo `Colocação · Rampa` (Nível de topo, Desloc. da base, Desloc. do topo, Altura sem nível acima).
- **Seleção de tipo** (`ToolTypeProps.tsx`, `typeOptions.ts`, `TypePreview.tsx`, `TypeRow.tsx`, `browser/Families.tsx`): categoria "Rampas" com `rampOptions(p)`; prévia do tipo (`RampSectionPreview.tsx`, novo): corte do lance (parte inclinada + espessura) com cota `i = 8,33 % (1:12)`.
- **Propriedades** (`ui/RampProperties.tsx`, novo; `Properties.tsx` roteia `kinds === 1 && ramps.length > 0`): Tipo; Nível base; Nível topo; Desloc. base/topo; Largura (regenera); Modo (`Comprimento` / `Inclinação`); Inclinação alvo (%, só no modo `slope`; regenera); Comprimento do percurso (m, regenera em modo `length`); Forma, Giro (somente leitura); abertura da laje (Modo, Pé-direito livre, Folga lateral, Furo retangular); Resultados somente leitura: Desnível, Inclinação (`8,33 % (1:12)`), Lances, Patamares, Comprimento do percurso, Área, Volume; lista de avisos (`rampValidationIssues` do elemento). Editar largura/inclinação/comprimento usa `regenRamp` e grava `updateElements` com `{ components, inputMode, slopeTarget, landingDepth }` em UMA transação `Editar rampa`.
- **Diálogo do tipo** (`ui/dialogs/RampTypeDialog.tsx`, novo; registrar em `App.tsx` `case 'rampType'`): `Dialog size="mid"` com `TypeDialogHeader`, rascunho por `structuredClone`, OK/Aplicar/Cancelar/Excluir como `SlabTypeDialog`. Seções: Identificação (Nome, Código, Descrição, Custo); Dimensões (`structuralDepth`, `landingThickness`, `defaultWidth`, `minWidth`, `landingMinLength`, `minHeadroom`, `defaultSlope` em %); Material; Norma (perfil: Personalizado / NBR 9050 / ADA — escolher um perfil copia a tabela correspondente e `normChecked` do perfil; marcador visível `a conferir` com caixa "Norma conferida" que liga `normChecked`; tabela editável: linhas com Inclinação até (%), Desnível máx. por lance (m), Máx. de lances (vazio = sem limite), botões Adicionar/Remover linha). Texto fixo sob a tabela: `Valores de referência de fonte secundária; confira a norma vigente antes de usar.` Validação por `rampTypeIssue`; mensagem inline.
- **Ações de tipo** (`editor/rampTypeActions.ts`, novo): `duplicateRampType`, `renameRampType`, `rampTypeDeleteBlock(p, typeId)`, `tryDeleteRampType`; segue `stairTypeActions.ts`. `editor/typeActions.ts`: `TypeKind` ganha `'ramp'`.
- **Tabela** (`ui/dialogs/RampScheduleDialog.tsx`, novo; `browser/Views.tsx` item `Tabela de rampas`, `count('ramp')`): colunas do `RampScheduleRow`, totais, filtro por tipo/nível, exportar CSV (`rampScheduleToCsv`), como `StairScheduleDialog.tsx`.
- **Outros**: `editor/rampActions.ts` (`rampBox`, `rampPoints`, como `stairActions.ts`) usado em `issuesView.ts` ("Ir para" um aviso) e `typeActions.ts`; `editor/avisosProjeto.ts` soma `rampValidationIssues(p)`; `editor/contextMenu.ts` (`TIPOS_EM_BREVE` mantém `stair`, `room`; rampa também esmaecida em "semelhante"); `ui/dialogs/OtherDialogs.tsx` (texto de atalho: `ramp: 'Rampa reta, em L ou em U'`).
- **i18n**: chaves em `editor/i18n.ts` nos blocos `pt` e `en`: `tool_ramp` (`Rampa` / `Ramp`), `ramp_type_title`, `ramp_prop_*`, `ramp_norm_*`, `ramp_issue_*` (rótulos de código de aviso, quando a UI os traduz), `sched_noun_ramp_one/many` em `i18nTabelas.ts`. `editor/i18n.test.ts` já exige paridade pt/en: manter verde.

Textos pt-BR exatos de UI: `Modo de entrada`, `Comprimento → inclinação`, `Inclinação → comprimento`, `Inclinação alvo`, `Comprimento do percurso`, `Desnível`, `Norma a conferir`, `Norma conferida`, `Perfil de norma`, `Personalizado`, `NBR 9050`, `ADA`.

## 7. Lista COMPLETA de arquivos por fase

### Fase 1 — modelo e motor (tarefa-rampa-1)

Criar: `packages/model/src/{rampTypes,ramp,rampTransform,validateRamps}.ts`; testes `ramp.test.ts`, `rampTransform.test.ts`, `validateRamps.test.ts`, mais casos novos em `migrate`/esquema (arquivo de teste de migração existente). `packages/engine/src/{rampPlan,ramps,rampIssues,rampOpenings,levelOpenings,rampBody,rampQuantities,rampSchedule,rampEdit}.ts`; testes `rampPlan.test.ts`, `ramps.test.ts`, `rampIssues.test.ts`, `rampOpenings.test.ts`, `rampBody.test.ts`, `rampQuantities.test.ts`, `rampSchedule.test.ts`, `rampEdit.test.ts`. `packages/tools/src/rampOptions.ts` e um esqueleto `packages/tools/src/rampTool.ts`.
Editar: `packages/model/src/{types,index,defaults,migrate,commands,queries,elementLevel,validate(onde chama stairIssues),graphics,stairTransform}.ts`; `packages/engine/src/{index,stairOpenings,floors,slabs,ceilings,junctionIndex,viewClass,viewWarnings}.ts`; `packages/tools/src/{registry,types,index}.ts` (só `'ramp'`, o rótulo, a opção `ramp?` e o `export`).

### Fase 2 — ferramenta (tarefa-rampa-2)

Criar: `packages/tools/src/{rampCommands,rampPick,rampPreview}.ts` e testes; SUBSTITUIR `rampTool.ts` (o esqueleto da Fase 1). Editar: `registry.ts`, `types.ts`, `index.ts`, `shortcutDefaults.ts`, `selectTool.ts`, `selectionFilters.ts`, `clipboard.ts`, `edit.ts`, `stairPick.ts` (generalizar tipos).

### Fase 3 — render (tarefa-rampa-3)

Criar: `packages/render/src/plan/ramps.ts`, `packages/render/src/model3d/rampSolids.ts`, `packages/engine/src/sectionRamps.ts`, testes `plan/ramps.test.ts`, `model3d/rampSolids.test.ts`, `sectionRamps.test.ts`. Editar: `plan/{resolucao,build,planContext,planOverlay,view,tags,stairs(exportar climbArrow)}.ts`, `model3d/{scene3d,chaveNivel3d}.ts`, `section/pick.ts`, `packages/engine/src/{section,sectionStairs(exportar convexHull),index}.ts`.

### Fase 4 — IFC e DXF (tarefa-rampa-4)

Editar: `packages/io/src/ifc/{ifcTypes,ifcElements,ifcExport}.ts`, `packages/io/src/dxf.ts`, `apps/web/src/editor/{ifcExport,dxfExport}.ts`. Criar testes `ifcRamp.test.ts`, `dxfRamps.test.ts`.

### Fase 5 — interface (tarefa-rampa-5)

Criar: `apps/web/src/ui/{RampOptionsBar,RampProperties}.tsx`, `apps/web/src/ui/dialogs/{RampTypeDialog,RampScheduleDialog,RampSectionPreview}.tsx`, `apps/web/src/editor/{rampActions,rampTypeActions}.ts` e testes. Editar: `editor/{state,typeActions,issuesView,avisosProjeto,contextMenu,i18n,i18nTabelas,toolSelection}.ts`, `ui/{Icon,OptionsBar,PlacementProperties,Properties,ToolTypeProps,TypePreview,TypeRow,typeOptions}.tsx/ts`, `ui/browser/{Families,Views}.tsx`, `ui/ribbon/{tabsMain,actions,context,model}.ts`, `ui/dialogs/OtherDialogs.tsx`, `App.tsx`.

## 8. Riscos

1. Estado em andamento do ramo: a regra de cálculo da escada (`StairCalcRule`, `treadRuleOf`) está sendo mesclada; as tarefas partem da branch com ela mesclada. `SCHEMA_VERSION` pode ser outro número: a migração usa sempre a versão antiga como chave.
2. Categoria gráfica compartilhada com a escada (decisão A): esconder "Escada" também esconde rampa. Aceito na v1; documentar na UI (rótulo `escada e rampa`).
3. `stairRunSteps` com 2 espelhos e `distributeRisers` para fatias: validar em lance de largura 0,9 a 3,0 m e comprimento de 0,6 a 30 m. `distributeRisers` usa a linha média; em lance reto é exata.
4. Desempenho: ~10 fatias por metro de lance. Uma rampa de 60 m dá 600 fatias: usar o teto de 400 por lance e `memoDoProjeto` na planta; medir com o teste de desempenho existente (`npm run test:perf`) se algum ficar lento.
5. Furo da laje: pode divergir da escada se `trimBeyondTop` receber o quadro errado. Teste obrigatório com rampa que chega ao nível de cima e uma laje com face inferior a 0,15 m do topo.
6. Inclinação em fração versus %: toda UI converte. Teste de ida e volta (digitar `8,33` → guarda `0,0833`).
7. Normas de fonte secundária: rótulo "a conferir" obrigatório, nunca bloquear. Nenhum número de norma hardcoded fora de `DEFAULT_RAMP_NORM_*`.
8. Espelhar: `turn` precisa inverter junto com a geometria, ou a regeneração gira para o lado errado. Teste de ida e volta (espelhar, regenerar, comparar).
9. L/U com `n = 2` fixo: desnível grande dá aviso `ramp-flight-rise-over-norm`, não cria mais lances. Documentado como limitação (fora de escopo F).
10. Ordem dos componentes do gerador L/U: o 2º lance começa na borda do patamar; confirme que `rise` por comprimento dá a cota certa ao patamar (= cota ao fim do 1º lance).
11. `StairGenerator` já aceita `'straight' | 'lshape' | 'ushape'`; não adicionar valor novo.
12. Cache de 3D e de níveis: esquecer `isRamp` em `junctionIndex.ts` ou na chave do 3D deixa lajes/3D desatualizados após editar a rampa. Teste: editar a rampa muda o furo da laje.
13. `check-boundaries`: `tools` não importa `render`; `io` só importa `model`; a montagem da geometria do IFC/DXF fica em `apps/web`.

## 9. Testes obrigatórios (mínimo)

- `rampPlan.test.ts`: os 7 exemplos de §2.1.1, mais L e U (n=2, patamar, lances iguais), mais erros, mais "reta com 3 lances" (H=2,40, slope=1/12: maxRise 0,8 → n=3; ΣL=28,8; L=9,6 cada; pathLength=28,8+2×1,2=31,2).
- `ramps.test.ts`: cotas (z0/z1 de cada lance, z do patamar) para o exemplo 2 (lance 1: 0→0,60; patamar z=0,60; lance 2: 0,60→1,20, com baseZ=0); `slope` uniforme; fatias (número ≈ ceil(L/0,10)); erro `ramp-run-edges` com 3 espelhos; tipo ausente → sem rampa.
- `rampIssues.test.ts`: um caso por código de §2.3 (exemplo 5 → `ramp-slope-over-norm`; largura 1,0 com `minWidth 1,2` → `ramp-width-min`; patamar de 1,0 m → `ramp-landing-short`; `normChecked=false` → sufixo; `normChecked=true` → sem sufixo; tabela vazia → nenhum aviso de norma).
- `rampOpenings.test.ts`: modo `none` → vazio; `full` → igual ao footprint; `headroom`: rampa reta de 9,60 m (H=0,80, inclinação 1/12, base z=0), face inferior da laje em z=2,50 e folga 2,10 → entram as fatias com `z >= 0,40`, isto é, o trecho de 4,80 m a 9,60 m do início (tolerância de 0,10 m, uma fatia); integração com `slabs.ts` e `floors.ts` (a laje do nível de topo é furada pela rampa).
- `rampBody.test.ts` e `rampQuantities.test.ts`: números de §2.5.
- Migração: projeto v(N−1) sem `rampTypes` migra e ganha os 2 tipos; roundtrip de salvar/abrir com rampa.
- Comandos: `addRamp`, desfazer/refazer, `deleteRampType` em uso, transformações (mover, girar, espelhar inverte `turn`).
- Ferramenta: cliques de §3 nos dois modos (nota "termina antes do clique" e "passa do clique"), digitar ângulo, Esc, uma transação por rampa.
- Render: planta tem seta + texto `8,33 % (1:12)`; corte parte a lance em dois por `cutZ`; 3D gera lote com `ids` da rampa; corte (seção) devolve trapézios inclinados.
- IFC: `IFCRAMP`, `IFCRAMPFLIGHT`, `IFCRELAGGREGATES`, patamar `IFCSLAB` com `LANDING`. DXF: camadas `RAMPA`, `RAMPA_SETA`, `RAMPA_TEXTO` com o texto `8,33 % (1:12)`.
- UI: i18n pt/en em paridade; digitar inclinação em % grava fração; diálogo de tipo bloqueia tabela fora de ordem.
- Portas finais: `npx vitest run`, `npx tsc --noEmit` (raiz), `npx eslint .`, `node scripts/check-boundaries.mjs`.
