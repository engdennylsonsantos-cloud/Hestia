# Contrato técnico da ESCADA LIVRE (Hestia)

Método "escada livre": o usuário clica um trajeto (polilinha) com mudanças de direção em qualquer ângulo. Cada trecho reto vira um lance (`generateStraightRun`); cada vértice com giro vira um patamar de giro com mitra; ao vivo a ferramenta diz "faltam N espelhos". Espelha a RAMPA LIVRE já pronta (`rampFree.ts`, `rampLive.ts`, `rampLiveSession.ts`, `rampEdit.ts`), com a diferença central: na rampa o desnível por metro é variável (inclinação); na escada o piso é FIXO (Blondel) e o que se conta são ESPELHOS.

Leitura base: `packages/engine/src/{rampFree,rampLive,rampEdit,stairGenerators,stairs,stairIssues,stairNorms}.ts`, `packages/tools/src/{rampLiveSession,rampTool,rampGrips,stairRunTool,stairRunPlan,stairRunEdit,stairCommands,stairSketchState}.ts`, `apps/web/src/editor/rampActions.ts`, `apps/web/src/ui/{RampProperties,StairProperties,StairRunOptionsBar}.tsx`.

## 0. Decisões fechadas (não reabrir)

1. Regra de Blondel por tipo: `treadRuleOf(type)` + `treadFor(h, rule)` (já existem).
2. Patamares SÓ (a) nas curvas (vértice com giro) e (b) dentro de um trecho quando o lance excederia o máximo de espelhos por lance da norma. Sem leque, sem cunha.
3. N = `riserCountFor(H, type.maxRiser)` = ceil(H ÷ espelho máx), h = H ÷ N, piso T = `treadFor(h, rule)`.
4. O trajeto é uma polilinha. Trecho reto = um lance; vértice com giro = patamar de giro com mitra (mesma geometria da rampa, via auxiliar compartilhado extraído de `rampFree.ts`, sem mudar a rampa).
5. A ferramenta mostra ao vivo "faltam N espelhos" / "alcançado" / "passou". Sessão de desenho SEM operações booleanas e sem `resolveStairs` por movimento (meta: 2 ms por `move`).
6. Se o plano é recusado ao concluir, o rascunho volta (`session.load`).
7. "Ajustar" (tecla A e botão nas Propriedades) escolhe N, h e piso para o trajeto caber na regra Blondel do tipo.
8. Editar por grips e por propriedades regenera a partir do trajeto.
9. Modelo (outro agente, branch `feat/e-stairfree-model`): `Stair.freePath?: Vec2[]`, `Stair.manualLandings?: number[]`, `StairGenerator` ganha `'free'`. Este contrato NÃO mexe no modelo.

### 0.1 Decisões de projeto deste contrato (derivadas; o orquestrador pode vetar)

- D1. Um piso só em toda a escada (T). Cada lance tem os espelhos a T de distância exata. A folga do trecho (distância que sobra depois do último espelho) é absorvida pelo patamar de giro (fica mais fundo no lado de entrada, no máximo T a mais). Nunca se estica o piso.
- D2. Vértice com giro menor que 3° (`FREE_COLLINEAR_ANGLE`) e que não está em `manualLandings` é DISSOLVIDO: o trecho passa direto do vértice anterior mantido ao seguinte mantido (a escada não tem patamar ali). O vértice continua no `freePath` (grips), só não vira geometria.
- D3. Trecho entre duas curvas que não comporta um lance de 2 espelhos vira "trecho de passagem": um patamar retangular entre os dois patamares de giro (caso típico: escada em U com 3 trechos). O 1º e o último trecho nunca são de passagem.
- D4. Trajeto mais curto que o necessário: o ÚLTIMO trecho é estendido na sua direção até completar N espelhos (nota "Trajeto estendido em X m ..."), como a rampa no modo inclinação. Trajeto mais longo: a escada fecha no espelho N e os vértices depois do fechamento saem do `freePath`.
- D5. O `freePath` devolvido pelo plano é normalizado: o último vértice é o centro do último espelho; vértices após o fechamento caem.
- D6. Edição preserva (N, T) medidos da escada atual enquanto h = H ÷ N ≤ espelho máx do tipo e N ≥ 2; senão recalcula pelos padrões (3). Assim "Ajustar" persiste nas edições seguintes. A profundidade do patamar de giro após edição = largura do lance (o valor da barra de opções vale só na criação).
- D7. A tecla A fica na ferramenta (tarefa 2), o botão Ajustar nas Propriedades (tarefa 3).

## 1. Convenções geométricas

- Trecho k vai de `P[k]` a `P[k+1]`, direção unitária `d_k`, comprimento `len_k`, esquerda `perp(d_k)`. Coordenada local `u` ao longo do trecho a partir de `P[k]`.
- Lance de `n` espelhos de piso `T`: primeiro espelho em `u0`, último em `u0 + (n−1)·T` (`generateStraightRun({ start, dir, width, risers: n, tread: T })`; `start` = centro do 1º espelho).
- Espelho do último degrau do lance encosta na borda de entrada do patamar; o 1º espelho do lance seguinte fica na borda de saída do patamar (mesma convenção de `generateLShape`). N total = soma dos espelhos dos lances (patamares não contam).
- Patamar de giro no vértice `v` (ângulo de giro θ entre `d_A` e `d_B`, largura `w`, profundidade D):
  - `tMin = (w/2)·tan(θ/2)` (menor recuo sem polígono autointerceptante);
  - `tPref = max(D²/(2w), tMin)` (área ≥ D × D). Padrão D = largura do lance (como L e U);
  - recuo de entrada `a` (sobre o trecho A, antes do vértice) e de saída `b` (sobre o trecho B, depois). Lado de saída `b = tPref` (ou `tMin` se o trecho for curto). Lado de entrada `a = len_A − u_último_espelho` (≥ tPref; a folga vai aqui).
  - Anel (6 pontos): `[aIn, inner, bIn, bOut, outer, aOut]` com `h = sgn·w/2`, `miter = (nA+nB)·h/(1+nA·nB)`, `aIn = v − dA·a + nA·h`, `aOut = v − dA·a − nA·h`, `bIn = v + dB·b + nB·h`, `bOut = v + dB·b − nB·h`, `inner = v + miter`, `outer = v − miter`; `sgn = +1` se `cross(dA,dB) ≥ 0`. É a mesma fórmula de `turnLanding` em `rampFree.ts`, generalizada com `a ≠ b`.
  - Em θ = 90° com a = b = w/2 três pontos coincidem; para a escada o auxiliar `compactRing` remove vértices repetidos (distância < 1e-9). A rampa continua usando o anel cru (sem mudança).
- Patamar em linha (lance com mais espelhos que o máximo por lance): retângulo `inlineLanding(at, u0, u0 + P, −w/2, w/2)` com `P = max(norms.landingMinLength, w)`.
- Máximo de espelhos por lance: `M = max(2, floor(norms.maxRiseBetweenLandings / h + 1e-9))` (a norma avisa quando `risers.length · h > 3,2 m`). Com `DEFAULT_STAIR_NORMS` (3,2 m) e h = 0,175: M = 18.
- Tolerância de contagem `EPS = 1e-9`: espelhos que cabem em um vão `s` a partir de um espelho: `floor(s/T + EPS) + 1` (2 espelhos exigem `s ≥ T`).

## 2. Engine (pure, sem projeto, sem booleanas): arquivos novos

### 2.1 `packages/engine/src/freePathGeom.ts` (extração do auxiliar compartilhado)

Move de `rampFree.ts` para cá, sem mudar nenhum comportamento da rampa:

```ts
export const FREE_COLLINEAR_ANGLE: number;            // 3° em rad (hoje exportado por rampFree.ts)
export const FREE_MAX_TURN_ANGLE: number;             // 150° em rad
export const FREE_OVERLAP_AREA: number;               // 1e-3 m² (era OVERLAP_AREA)
export function turnTMin(theta: number, width: number): number;       // (w/2)·tan(θ/2)
export function turnLandingRing(v: Vec2, dA: Vec2, dB: Vec2, width: number, tIn: number, tOut?: number): Vec2[]; // 6 pontos, tOut = tIn por padrão
export function turnLandingSketch(v, dA, dB, width, tIn, tOut?): StairComponentSketch;   // kind 'landing', arestas retas sag 0 (anel cru)
export function compactRing(ring: Vec2[], eps?: number): Vec2[];      // remove consecutivos repetidos e o fechamento repetido
export function partRing(p: StairComponentSketch): Ring | null;
export function findSelfOverlap(parts: StairComponentSketch[], segOf: number[]): { a: number; b: number } | null;
```

`rampFree.ts` passa a importar daqui (`turnLandingSketch(tr.v, tr.dA, tr.dB, w, tr.t)`, `findSelfOverlap`, constantes) e REEXPORTA `FREE_COLLINEAR_ANGLE` e `FREE_MAX_TURN_ANGLE` (`export { FREE_COLLINEAR_ANGLE, FREE_MAX_TURN_ANGLE } from './freePathGeom.ts'`) para o `export *` do `index.ts` não mudar. No `index.ts` do engine acrescente apenas exports NOMEADOS de `freePathGeom.ts` (`turnLandingRing`, `turnLandingSketch`, `compactRing`, `turnTMin`, `findSelfOverlap`), nunca `export *` (as constantes já saem por `rampFree.ts`). O `turnRing` privado de `rampLiveSession.ts` NÃO é tocado nesta versão.

### 2.2 `packages/engine/src/stairLive.ts` (layout em espelhos/pisos, restante, distribuição)

```ts
import type { StairType } from '@hestia/model';
import { treadRuleOf, treadFor, riserCountFor } from './stairGenerators.ts';
import { DEFAULT_STAIR_NORMS, type StairNorms } from './stairNorms.ts';

export const STAIR_COUNT_EPS = 1e-9;

/** Par (N, T) fixado por "Ajustar" ou medido da escada existente. */
export interface StairFixed { risers: number; tread: number }

export interface StairLiveParams {
  risers: number;        // N
  riserHeight: number;   // h = H / N
  tread: number;         // T
  maxPerFlight: number;  // M
  landingLength: number; // P do patamar em linha
}

/** N, h, T, M. `fixed` troca N e T (h = H/N). Erro pt-BR se H ≤ 0, N < 2 ou tipo inválido. */
export function stairLiveParams(H: number, type: StairType, opts?: { fixed?: StairFixed; width?: number; norms?: StairNorms }): StairLiveParams | { error: string };

export interface StairLayoutPiece {
  kind: 'flight' | 'landing';
  at: number;       // u do 1º espelho do lance (ou do início do patamar), a partir do início do vão
  length: number;   // lance: (n−1)·T ; patamar: P
  risers: number;   // lance: n ≥ 2 ; patamar: 0
}
export interface StairSegmentLayout {
  pieces: StairLayoutPiece[];
  risers: number;   // total de espelhos do vão
  length: number;   // do início do vão ao fim da última peça (último espelho)
  leftover1: boolean; // true se sobrou exatamente 1 espelho a colocar e não foi possível rebalancear
}

/**
 * Layout de um vão `span` (m; distância disponível entre o 1º espelho e o último espelho permitido; pode ser Infinity
 * quando `need` é finito). Preenche lances de no máximo M espelhos; entre dois lances cheios vai um patamar de P m,
 * mas só se sobra espaço para P + T (lance seguinte de ≥ 2 espelhos) e ainda faltam espelhos. Para quando colocou
 * `need` espelhos. Regra do resto: se faltaria exatamente 1 espelho depois de um lance, tira 1 do lance (n−1 ≥ 2).
 */
export function layoutStairSegment(span: number, p: Pick<StairLiveParams, 'tread' | 'maxPerFlight' | 'landingLength'>, need?: number, balanceTail?: boolean): StairSegmentLayout;

export interface StairRemaining {
  status: 'falta' | 'alcancado' | 'passou';
  placed: number;      // espelhos até o cursor (limitado a N)
  falta: number;       // espelhos que faltam (status 'falta'), senão 0
  faltaLength: number; // ≈ falta · T (m)
  excess: number;      // espelhos a mais que o cursor colocaria ('passou'), senão 0
  closeAt: number | null; // distância (do início do vão vivo) do espelho N; null se ainda não fecha
}
/** Restante em espelhos para o cursor: `span` = vão vivo, `risersBefore` = espelhos já colocados nos trechos anteriores. */
export function liveStairRemaining(i: { params: StairLiveParams; span: number; risersBefore: number }): StairRemaining;

/** Distribuição de N espelhos entre os vãos de um trajeto de comprimento FIXO. */
export interface StairDistribution {
  layouts: StairSegmentLayout[];  // um por vão (vão sem espaço = layout vazio)
  placed: number;                 // espelhos colocados (≤ N)
  closedAt: number | null;        // índice do vão em que o espelho N foi colocado; null se faltaram espelhos
  missing: number;                // N − placed
}
export function distributeRisers(spans: number[], p: StairLiveParams): StairDistribution;
```

Regras de `layoutStairSegment(span, p, need = Infinity, balanceTail = true)` (`balanceTail = false` desliga a regra do resto; é usado no ÚLTIMO vão, que pode ser estendido):

```
pos = 0; rem = span; left = need
repita (no máximo 200 voltas):
  cap = floor(rem / T + EPS) + 1                  // se rem < 0, cap = 0
  n = min(cap, M, left)
  se n < 2: pare
  se balanceTail e left − n === 1: se n − 1 ≥ 2 então n = n − 1; senão leftover1 = true
  emita lance { at: pos, length: (n−1)·T, risers: n }
  pos += (n−1)·T; rem −= (n−1)·T; left −= n
  se left < 2: pare                               // nunca patamar sem um lance de ≥ 2 espelhos depois
  se n < M (parou por falta de espaço): pare
  se rem < P + T − EPS: pare
  emita patamar { at: pos, length: P }; pos += P; rem −= P
retorne { pieces, risers: soma, length: pos, leftover1 }
```

`liveStairRemaining`: `need = N − risersBefore`; `lay = layoutStairSegment(span, p)` (sem `need`); `count = lay.risers`; `falta = need − count`. `falta > 0` → `falta`; `== 0` → `alcancado`; `< 0` → `passou` com `excess = −falta` e `closeAt = layoutStairSegment(Infinity, p, need).length`. Em `alcancado`, `closeAt = lay.length`. `faltaLength = falta · T`.

`distributeRisers(spans, p)`: `left = N`; para cada vão em ordem: `lay = spans[k] >= T − EPS ? layoutStairSegment(spans[k], p, left, k < spans.length − 1) : vazio`; acumula; quando `left` zera, `closedAt = k` e os vãos seguintes ficam vazios. O vão de passagem (span < T) devolve layout vazio (quem trata é o plano).

### 2.3 `packages/engine/src/stairFree.ts` (plano do trajeto livre e otimizador)

```ts
import type { Vec2 } from '@hestia/geom';
import type { StairType } from '@hestia/model';

export interface StairFreeOptions {
  width: number;                 // largura do lance (m)
  landingDepth?: number;         // profundidade do patamar de giro; padrão = width; nunca menor que width
  manualLandings?: number[];     // índices do trajeto ORIGINAL com patamar forçado
  fixed?: StairFixed;            // N e T fixos (Ajustar / medidos); ausente = padrões do tipo
  norms?: StairNorms;            // padrão DEFAULT_STAIR_NORMS
}

export interface StairFreePlan {
  parts: StairComponentSketch[];  // lances e patamares em ordem do trajeto (sem `generatedBy`)
  risers: number;                 // N
  riserHeight: number;            // h
  tread: number;                  // T
  runs: number;                   // nº de lances
  landings: number;               // nº de patamares (giro + em linha + passagem)
  path: Vec2[];                   // trajeto normalizado (D5)
  extended: number;               // m de trajeto estendido (D4), 0 se não
  slack: number;                  // m de trajeto que sobra depois do espelho N (inclui trechos descartados)
  truncated: boolean;             // houve vértices descartados depois do fechamento
  note?: string;
}
export type StairFreePlanResult = StairFreePlan | { error: string };

/** Recuos de um vértice. */
export interface TurnRecuo { tMin: number; tPref: number }
export function turnRecuo(theta: number, width: number, depth: number): TurnRecuo;   // tMin = turnTMin; tPref = max(D²/(2w), tMin)

/** Como o vão de um trecho é usado (D3). */
export interface SegmentFit { kind: 'run' | 'pass' | 'short'; bIn: number; aOut: number; span: number }
export function fitSegment(len: number, tread: number, tin: TurnRecuo | null, tout: TurnRecuo | null): SegmentFit;

export function planStairFree(path: Vec2[], H: number, type: StairType, o: StairFreeOptions): StairFreePlanResult;
```

`fitSegment` (usa só tread, comprimento e recuos; `tin` = curva no início do trecho, `tout` = curva no fim; null = ponta do trajeto):
1. `prefSpan = len − (tin?.tPref ?? 0) − (tout?.tPref ?? 0)`. Se `prefSpan ≥ T − EPS` → `{ kind:'run', bIn: tin?.tPref ?? 0, aOut: tout?.tPref ?? 0, span: prefSpan }`.
2. `minSpan = len − (tin?.tMin ?? 0) − (tout?.tMin ?? 0)`. Se `minSpan ≥ T − EPS` → `run` com os recuos mínimos e `span = minSpan`.
3. Se `tin && tout` e `minSpan ≥ −EPS`: `pass`; usa `tPref` nas duas pontas se `prefSpan ≥ 0`, senão `tMin`; `span = len − bIn − aOut` (comprimento do retângulo, pode ser 0).
4. Senão `short`.

`planStairFree` passo a passo:
1. Valida: `width > 0`; `H > 0` (erro "A altura deve ser positiva: nada a gerar."); tipo.
2. Parâmetros: `stairLiveParams(H, type, { fixed: o.fixed, norms })`.
3. Limpa o trajeto: descarta pontos a menos de 0,01 m do anterior (guarda o índice original); `< 2` pontos → erro. Calcula θ de cada vértice interior; θ > `FREE_MAX_TURN_ANGLE` → erro "Retorno agudo demais no vértice k: use dois giros menores." (k = posição 1-based no trajeto original); θ < `FREE_COLLINEAR_ANGLE` e vértice fora de `manualLandings` → dissolve (D2) e refaz os trechos; vértices restantes ficam como `turns[]` (cada um com `recuo = turnRecuo(θ, w, D)`).
4. Para cada trecho k: `fit[k] = fitSegment(len_k, T, turnIn, turnOut)`. O ÚLTIMO trecho nunca é erro por curto: `bIn = turnIn?.tPref ?? 0`, `span = max(0, len − bIn)`, e pode ser estendido (D4). `short` em trecho que não é o último → erro "O trecho k é curto demais para o patamar de giro." (só se o fechamento ainda não ocorreu antes dele). `pass` no 1º trecho → erro "O 1º trecho é curto demais para um lance (mínimo 2 espelhos).".
5. `distribute = distributeRisers(spans, params)` com `spans[k] = fit.kind === 'run' ? fit.span : 0`. Se o 1º vão ficou sem lance → erro do passo 4. Se `leftover1` e ainda sobram espelhos → erro "Poucos espelhos (N) para o patamar de giro no vértice k: alongue o trecho k−1 ou use uma escada reta.".
6. Se `distribute.missing > 0`: estende o último trecho: `layoutStairSegment(Infinity, p, N − placedAntesDoUltimo)`, `extended = lay.length − (último espelho do vão original)`. O trecho `pass` não pode ser o último (regra 4). Vértices e comprimentos do trajeto mudam só no último ponto (D5).
7. Monta os componentes na ordem: para cada trecho usado: peças do layout (lance → `generateStraightRun({ start: at(bIn+piece.at, 0), dir: d, width: w, risers: n, tread: T })`; patamar em linha → `inlineLanding(at, bIn+piece.at, bIn+piece.at+P, −w/2, w/2)`); trecho `pass` → `inlineLanding(at, bIn, bIn+span, −w/2, w/2)` (some se `span < 1e-6`); depois, se há curva no fim e o trecho seguinte é usado: `turnLandingSketch` com `tIn = len_k − (bIn + lay.length)` (a folga entra aqui; ≥ tPref por construção) e `tOut = bNext`. Para a saída use o anel `compactRing`: `{ kind:'landing', landing:{ boundary: ring.map(…linha sag 0) } }`.
8. `findSelfOverlap(parts, segOf)` ≠ null → erro "O trajeto se sobrepõe ao trecho j: afaste o ponto." (j = trecho 1-based do componente `a`).
9. Normaliza o `path` (D5) e calcula `slack`, `extended`, `truncated`, `note`, `runs`, `landings`. `planStairFree` NUNCA devolve polígono autointerceptante nem lance de 1 espelho.

`riserHeight = H / N`; a soma de espelhos dos lances é exatamente N (teste). Nenhuma exceção escapa: erros do gerador (`RangeError`) viram `{ error }`.

```ts
export interface OptimizeStairInput {
  path: Vec2[]; H: number; type: StairType; width: number;
  landingDepth?: number; manualLandings?: number[]; norms?: StairNorms;
}
export interface OptimizeStairResult {
  fixed: StairFixed;       // N e T escolhidos
  riserHeight: number;
  path: Vec2[];            // trajeto ajustado (último trecho esticado/encurtado pelo plano)
  gap: number;             // antes do ajuste de trajeto: + estende, − sobra (m)
  violation: number;       // soma das violações restantes (0 = tudo dentro da norma)
  messages: string[];      // violações em pt-BR
  plan: StairFreePlan;
  note: string;            // "Ajustado: ..."
}
export function optimizeStair(i: OptimizeStairInput): OptimizeStairResult | { error: string };
```

Algoritmo do `optimizeStair`:
1. `Nmin = riserCountFor(H, type.maxRiser)`. Candidatos N = Nmin … Nmin+4 com `h = H/N ≥ norms.riserMin − 1e-9` (pelo menos Nmin sempre entra).
2. Para cada N: `h = H/N`; faixa Blondel de T: `Tlo = max(type.minTread, (calcMin − a·h)/b)`, `Thi = min(type.maxTread, (calcMax − a·h)/b)` (a, b, calcMin, calcMax do tipo via `stairCalcRuleOf`); faixa vazia (`Tlo > Thi`) → T único = `treadFor(h, rule)` (violação registrada). `T0 = treadFor(h, rule)`.
3. Amostra T em `{T0, Tlo, Thi}` mais 9 pontos igualmente espaçados em `[Tlo, Thi]`; para cada um roda `planStairFree(path, …, { fixed: { risers: N, tread: T } })` e mede `gap = extended − slack`. Se dois amostras vizinhas trocam de sinal, refina por bissecção (20 iterações) e junta o melhor.
4. Custo lexicográfico por candidato (N, T): (1) violação: `max(0, h − type.maxRiser)` + `max(0, norms.riserMin − h) + max(0, h − norms.riserMax)` + distância do Blondel `a·h + b·T` à faixa `[calcMin, calcMax]` + distância de T a `[minTread, maxTread]`; plano com erro → descarta; (2) `|gap|`; (3) `|N − Nmin|`; (4) `|T − T0|`. Empate vence o menor custo na ordem.
5. O resultado usa o `path` e o `plan` do melhor candidato (o plano já normaliza o último ponto). Se nenhum candidato gera plano, devolve `{ error }` com o erro do candidato `Nmin`.
6. `note`: `Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.` ou `... trajeto encurtado em 0,50 m.` / `... trajeto estendido em 0,18 m.`; com violação > 0: acrescenta ` Sem opção dentro da norma: <messages>`.

## 3. Exemplos numéricos (tipo `stt_monolitica`: espelho máx 0,18; piso mín 0,28; 2h + T = 0,63; piso máx 0,32; norma `DEFAULT_STAIR_NORMS`)

### Exemplo 1: trajeto reto de 5 m, H = 2,80

N = ceil(2,80 ÷ 0,18 − 1e-9) = 16; h = 0,175; T = clamp(0,63 − 0,35) = 0,28; M = floor(3,2 ÷ 0,175) = 18 (≥ 16, sem patamar em linha).
- Plano de (0,0) a (5,0): vão = 5 (sem curvas); `layoutStairSegment(5, p, 16)`: cap = floor(5 ÷ 0,28) + 1 = 18, n = min(18, 18, 16) = 16 → 1 lance, comprimento 15 × 0,28 = 4,20 m. `slack = 0,80`; `path = [(0,0), (4.2,0)]`; nota "A escada termina 0,80 m antes do último ponto.".
- Ao vivo (`liveStairRemaining`, risersBefore = 0): cursor a 3,00 m → count = floor(3 ÷ 0,28) + 1 = 11 → `falta` 5, `faltaLength` 1,4 m. Cursor a 4,20 m → count 16 → `alcancado`, `closeAt` 4,20. Cursor a 5,00 m → count 18 → `passou`, `excess` 2, `closeAt` 4,20.
- Rótulo ao vivo: `16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)`.
- Ajustar (`optimizeStair`): N=16: faixa T [0,28; 0,30], melhor |gap| = 0,50 (T = 0,30, escada de 4,50 m). N=17: h = 0,16471, faixa T [0,3006; 0,3206], T de encaixe 5 ÷ 16 = 0,3125 dentro da faixa, gap 0. N=18: h = 0,1556 < 0,16 (violação). Vence N = 17, T = 0,3125, 2h + T = 0,6419: `Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.`
- Com H = 3,60 (inline): N = 20, h = 0,18, T = max(0,63 − 0,36 = 0,27; 0,28) = 0,28, M = floor(3,2 ÷ 0,18) = 17. Trecho reto de 7 m: lance 17 espelhos (4,48 m), patamar em linha P = 1,20 (w ≤ 1,2), lance de 3 espelhos (0,56 m). O resto 3 ≠ 1, sem rebalanceio. Trajeto usado 6,24 m.

### Exemplo 2: L de 3 + 2 m, largura 1,00, H = 2,80, `path = [(0,0),(3,0),(3,2)]`

N = 16, h = 0,175, T = 0,28, D = w = 1,00, θ = 90°: tMin = 0,5·tan45° = 0,5; tPref = max(1 ÷ 2, 0,5) = 0,5.
- Trecho 0 (curva só no fim): prefSpan = 3 − 0,5 = 2,5; n = floor(2,5 ÷ 0,28) + 1 = 9 → último espelho em u = 8 × 0,28 = 2,24; entrada do patamar `a = 3 − 2,24 = 0,76`.
- Patamar em (3,0): dA=(1,0), dB=(0,1), sgn=+1, h=0,5, a=0,76, b=0,5. aIn=(2.24,0.5), aOut=(2.24,−0.5), bIn=(2.5,0.5), bOut=(3.5,0.5), inner=(2.5,0.5), outer=(3.5,−0.5). Anel compactado: (2.24,0.5),(2.5,0.5),(3.5,0.5),(3.5,−0.5),(2.24,−0.5).
- Trecho 1: bIn = 0,5; vão = 2 − 0,5 = 1,5 → cap = floor(1,5 ÷ 0,28) + 1 = 6, menos que os 7 que faltam: a distribuição coloca 9 + 6 = 15 e falta 1 (`missing = 1`). Extensão: `layoutStairSegment(Infinity, p, 7)` = 1 lance de 7 espelhos, comprimento 1,68 → fim em y = 0,5 + 1,68 = 2,18. `extended = 0,18`; `path = [(0,0),(3,0),(3,2.18)]`; nota "Trajeto estendido em 0,18 m para completar 16 espelhos.". Componentes: lance(9) · patamar · lance(7). Total 16.
- Ao vivo, cursor a (3,1,0) com os 9 do trecho 0 já confirmados: vão vivo = 1,0 − 0,5 = 0,5 → count = floor(0,5 ÷ 0,28) + 1 = 2; risersBefore = 9 → faltam 5 espelhos.

### Exemplo 3: U com 3 trechos, largura 1,20, H = 2,80, `path = [(0,0),(3,0),(3,1.3),(0,1.3)]`

N = 16, T = 0,28, D = 1,20: dois giros de 90°, tMin = tPref = 0,6.
- Trecho 0: prefSpan = 3 − 0,6 = 2,4; n = floor(2,4 ÷ 0,28) + 1 = 9; `a = 3 − 2,24 = 0,76`.
- Trecho 1 (entre as curvas): len 1,3; prefSpan = 1,3 − 0,6 − 0,6 = 0,1 < T; minSpan idem; `kind = 'pass'`, retângulo de u = 0,6 a 0,7 (0,1 m) × largura 1,2, sem espelhos.
- Trecho 2 (último): bIn = 0,6; need = 16 − 9 = 7; cap = floor(2,4 ÷ 0,28) + 1 = 9; n = 7, último espelho em u = 0,6 + 6 × 0,28 = 2,28 → o ponto final vira (0,72; 1,3) (3 − 2,28). `slack = 0,72`, nota "A escada termina 0,72 m antes do último ponto.".
- Componentes: lance(9) · patamar(giro 1, a=0,76, b=0,6) · patamar(passagem) · patamar(giro 2, a=0,6, b=0,6) · lance(7). Espelhos 9 + 7 = 16. O retângulo do lance 1 (y de −0,6 a 0,6) e o do lance 3 (y de 0,7 a 1,9) não se tocam (vão de 0,10 m, como `generateUShape`).

## 4. Bordas (cada uma vira teste)

| Caso | Tratamento |
|---|---|
| Menos de 2 pontos distintos | erro "O trajeto precisa de ao menos dois pontos distintos." |
| Um trecho só | igual à escada reta de `planStairRun` (mesmo N, h, T); `generatedBy 'free'`, fim do trajeto normalizado |
| Trecho curto demais (entre curvas sem espaço nem para passagem, `len < tMin_in + tMin_out`) | erro "O trecho k é curto demais para o patamar de giro." |
| 1º trecho não comporta 2 espelhos | erro "O 1º trecho é curto demais para um lance (mínimo 2 espelhos)." |
| Último trecho curto | estendido (D4); sem erro |
| Retorno agudo (θ > 150°) | erro "Retorno agudo demais no vértice k: use dois giros menores." (para um U use dois giros de 90°) |
| Vértice quase colinear (θ < 3°) | dissolvido (D2); com `manualLandings` vira patamar (θ = 0 dá retângulo) |
| Trajeto passa do desnível | fecha no espelho N; vértices depois saem do `freePath`; nota "Trajeto encurtado: a escada fecha no espelho N, antes do último ponto."; ao vivo, estado REACHED |
| Trajeto curto | estende o último trecho (D4) |
| Trechos não adjacentes se sobrepõem | erro "O trajeto se sobrepõe ao trecho j: afaste o ponto." (`findSelfOverlap`, tolera contato de borda) |
| N pequeno demais para o patamar | N − n = 1 depois de um lance de 2 espelhos: erro "Poucos espelhos (N) para o patamar de giro no vértice k: alongue o trecho k−1 ou use uma escada reta."; N < 2: "A altura é menor que um espelho: nada a gerar." |
| Lance excede M | patamar em linha de P m (só quando sobra espaço para P + T) |
| H, largura ≤ 0 ou tipo inválido | erros pt-BR (como `planStairRun`) |

## 5. Ferramenta (packages/tools): sessão, integração, criação

### 5.1 `StairLiveSession` (`packages/tools/src/stairLiveSession.ts`), irmã de `RampLiveSession`

```ts
export type StairLiveState = 'IDLE' | 'ORIGIN' | 'DRAWING' | 'REACHED';
export interface StairLiveConfig { H: number; type: StairType; width: number; landingDepth?: number; fixed?: StairFixed; norms?: StairNorms }
export type StairLiveEvent =
  | { kind: 'added'; state: StairLiveState; message?: string }
  | { kind: 'ignored'; message: string }
  | { kind: 'warn'; message: string }
  | { kind: 'done'; path: Vec2[]; falta: number }; // falta = espelhos que faltam (0 se fechou)
export const STAIR_LIVE_MAX_VERTICES = 40;
export class StairLiveSession {
  constructor(cfg: StairLiveConfig);
  configure(cfg: StairLiveConfig): void;   // se N/T/larg./tipo mudaram, refaz o cache
  get state(): StairLiveState;
  get points(): Vec2[];
  get faltaConfirmada(): number;           // espelhos que faltam nos trechos confirmados
  preview(): PreviewItem[];
  hint(): string;
  click(c: Vec2): StairLiveEvent;
  move(p: Vec2, mpp?: number): PreviewItem[];
  back(): boolean;
  finish(): StairLiveEvent;
  load(path: Vec2[]): boolean;             // restaura o rascunho; false mantém o anterior
  cancel(): void;
  typeLength(m: number): StairLiveEvent;
}
```

Máquina de estados (igual à da rampa): `IDLE` → clique → `ORIGIN`; `ORIGIN` → clique (≥ 0,01 m) → `DRAWING` (ou `REACHED` se os `N` espelhos já cabem); em `REACHED` qualquer clique/Enter conclui; Backspace volta um ponto; Esc descarta; clique a menos de 0,05 m do último vértice (com ≥ 2 pontos) conclui; máximo 40 vértices. Concluir com `falta > 0` na 1ª vez só avisa (`warn`), na 2ª conclui; `done.falta` leva o que faltava. Mensagens de recusa do `click`: vizinhas das da rampa: "Afaste o cursor do último ponto.", "Retorno agudo demais: use dois giros menores.", "O trecho anterior é curto demais para o patamar de giro.", "Afaste o cursor: o trecho é curto demais depois do patamar de giro.", `Máximo de 40 pontos. Enter conclui.`.

`evaluate(c)` (por `move`; tudo O(nº de lances), sem `resolve*`, sem booleanas):
1. `v` = último ponto, `dir`, `L = |c − v|`. Se há trecho anterior `prev`:
   - θ = ângulo entre `prev.dir` e `dir`; θ > 150° → `{ ok:false, message }`.
   - θ < 3°: DISSOLVE (D2): `pts.pop()`, `segs.pop()` e reavalia `c` a partir do ponto anterior (laço, pois o novo ângulo pode ser colinear de novo). O estado "antes" de cada trecho (`risersBefore`, `bIn`) fica guardado em `Seg`.
   - senão: `tin = turnRecuo(θ, w, D)`; `prevFit = fitSegment(prev.len, T, prev.turnIn, tin)`; `short` → mensagem "O trecho anterior é curto demais para o patamar de giro."; `prevLay` = `layoutStairSegment(prevFit.span, p, needAntes)` (ou o retângulo de passagem), `risersBefore' = prev.risersBefore + prevLay.risers`; `bIn` do trecho vivo = `tin.tPref`.
2. Vão vivo = `L − bIn`; `< 0,01` → `short` (prévia tracejada). `liveStairRemaining({ params, span, risersBefore })` dá `falta`/`alcancado`/`passou`; se `passou`, o layout vivo é `layoutStairSegment(span, p, need)` (fecha no espelho N) e o ponto final do trecho vira o `closeAt`.
3. A prévia é montada com cache: itens dos trechos 0..n−2 congelados (`frozen`); a cada `move` só refaz o trecho anterior (por causa do giro) e o vivo. Cada lance: um polígono `tone:'tread'` (retângulo do 1º ao último espelho) e uma `line tone:'riser'` por espelho; patamares: `polygon tone:'landing'` (anel `compactRing` do giro, retângulos em linha e de passagem); eixo `line tone:'path'`. Rótulo no cursor (`label`): ver 5.4.
4. `move` ignora deslocamento menor que 1 px (`mpp`) quando nada mudou (`dirty` falso).

Orçamento: `move` ≤ 2 ms com 40 vértices e N ≤ 60 (teste de tempo; ver seção 11).

### 5.2 Integração no `StairRunTool` (`packages/tools/src/stairRunTool.ts`)

- `STAIR_RUN_SHAPES` ganha `'free'` (`stairRunPlan.ts`); `STAIR_RUN_SHAPE_LABEL.free = 'Livre'`; `MIN_RISERS.free = 2`; `planStairRun` com `shape === 'free'` devolve `{ error: 'A escada livre é planejada por planStairRunFree.' }`.
- `stairRunPlan.ts` exporta `planStairRunFree(i: StairFreePlanInput): StairRunPlanResult`, onde `StairFreePlanInput = { path: Vec2[]; H: number; type: StairType; options: StairRunToolOptions; fixed?: StairFixed }`. Chama `planStairFree` e devolve `StairRunPlan` (mesmo tipo de `planStairRun`) com `parts` marcadas `generatedBy: 'free'` (use `fromSketches(cs, 'free')`), mais os campos opcionais novos em `StairRunPlan`: `path?: Vec2[]; runs?: number; landings?: number; extended?: number; slack?: number`.
- Quando `opts.shape === 'free'` o `StairRunTool` delega à sessão (`this.free`): `start` (dica livre), `inputPrompt` ('Comprimento (m)' em ORIGIN/DRAWING), `move`/`click` (com `snap(p, { from: último ponto })`), `type` (comprimento), `confirm` (Enter conclui), `cancel` (1º Esc descarta o rascunho, 2º sai), `deleteKey` (Backspace volta um ponto), `adjust` (tecla A), `busy`, `reset` (também `session.cancel()`).
- Criação: `createFree(path)`: calcula `limitsNow()`, `planStairRunFree`, e se erro: `session.load(path)` + `move` no último ponto + mensagem "Não é possível criar a escada: <erro> Backspace volta um ponto." (rascunho recuperado). Se OK, UMA transação "Criar escada" chamando `stairFromGenerator(env, comps, { ...creation(), generatedBy: 'free', freePath: plan.path, manualLandings })`.
- Mensagem de criação: `Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm, 2 lances, 1 patamar.` + nota do plano + 1º aviso de norma (como hoje) + ` Ctrl+Z desfaz.`.
- `adjust()` (tecla A): `s.points.length < 2` → false. Chama `optimizeStair({ path: pts, H, type, width, landingDepth })`; em sucesso guarda `this.fixed = result.fixed` (campo da ferramenta, usado em `liveConfig`; limpo em `reset`), recarrega a sessão com `result.path` (`load`), diz `result.note`; se `load` recusa, restaura o trajeto anterior e diz "Não foi possível ajustar: o trajeto ajustado fica curto demais ou faz retorno agudo.". Sem `resolveStairs`.
- Opções (`StairRunToolOptions`) ganham nada de novo: `width` e `landingDepth` já existem (a barra mostra "Prof. patamar" também em 'free'; `turn` não vale em 'free').

### 5.3 Criação: `stairCommands.ts`

`StairCreateOptions` ganha `freePath?: Vec2[]; manualLandings?: number[]`; `createStairFromComponents` repassa para `makeStair({ ..., ...(opts.freePath ? { freePath: opts.freePath } : {}), ...(opts.manualLandings?.length ? { manualLandings: opts.manualLandings } : {}) })`. Continua UM `env.exec({ type: 'addStair', stair })` dentro da `env.transaction('Criar escada', …)` da ferramenta (um passo de desfazer). `updateStairComponents` (edição de croqui) passa a gravar `freePath: undefined, manualLandings: undefined` junto com os componentes: editar o croqui à mão descarta o trajeto livre (como o caracol descarta `spiral`).

### 5.4 Mensagens ao vivo (`packages/tools/src/stairLiveMessages.ts`, puro)

- `textoFaltaEspelhos(falta, faltaLength)`: `faltam 5 espelhos (≈ 1,4 m)`; singular `falta 1 espelho (≈ 0,3 m)`.
- `textoPassouEspelhos(excess)`: `passou 2 espelhos: a escada termina antes do cursor` (singular `passou 1 espelho: ...`).
- `TEXTO_ALCANCADO = 'nível de topo alcançado'`.
- `rotuloEscadaLivre(N, h, T, status)`: `16 espelhos · 17,5 cm · piso 28,0 cm · <falta|alcançado|passou>` (cm com 1 casa e vírgula).
- Dicas por estado: IDLE `Escada livre: clique o ponto inicial (centro do 1º espelho). Esc cancela.`; ORIGIN `Escada livre: clique o próximo ponto (ou digite o comprimento). Enter conclui, Backspace volta, Esc descarta.`; DRAWING `Escada livre: clique o próximo ponto (ou digite o comprimento). Enter ou clique no último ponto conclui, A ajusta, Backspace volta, Esc descarta.`; REACHED `Nível de topo alcançado. Enter ou clique conclui; A ajusta; Backspace volta.`.
- Concluir com falta: `Faltam 5 espelhos: Enter de novo estende o último trecho em 1,40 m e cria; A ajusta.`
- Patamar previsto: `Patamar de giro previsto (1,20 x 1,20 m)`.

## 6. Regeneração ao editar (engine + tools)

`packages/engine/src/stairFreeEdit.ts`:

```ts
export interface StairFreePatch { freePath?: Vec2[]; width?: number; landingDepth?: number; manualLandings?: number[]; fixed?: StairFixed | 'auto' }
export interface StairFreeResult { components: Array<StairRun | StairLanding>; freePath: Vec2[]; manualLandings?: number[]; plan: StairFreePlan }
export function measureFreeStair(stair: Stair): { width: number; fixed: StairFixed } | null;  // largura do 1º espelho do 1º lance; N = nº de espelhos distintos; T = distância média entre os 2 primeiros espelhos do 1º lance
export function regenStairFree(stair: Stair, p: Project, patch: StairFreePatch): StairFreeResult | { error: string };
```

`regenStairFree`: exige `stair.freePath` com ≥ 2 pontos (senão "A escada não tem trajeto livre para regenerar."); `H = stairTopZ − stairBaseZ`; `width = patch.width ?? measure.width`; `fixed`: `patch.fixed === 'auto'` → nenhum; `patch.fixed` objeto → ele; ausente → o medido (D6) se `H/N ≤ type.maxRiser + 1e-9`, senão nenhum; `planStairFree(patch.freePath ?? stair.freePath, H, type, { width, landingDepth: patch.landingDepth ?? width, manualLandings: patch.manualLandings ?? stair.manualLandings, fixed })`; os componentes reaproveitam os ids antigos da mesma posição (`toComponent` como `rampEdit.ts`, `newId('r')`/`newId('p')` para novos), cada lance com `generatedBy: 'free'`. Quem grava faz um `updateElements` numa transação com `{ components, freePath, manualLandings }`.

Disparos de regeneração:
- Grip de vértice (seção 7): `regenStairFree(stair, p, { freePath: novo })`.
- Propriedades: ao mudar tipo, nível base, nível de topo, deslocamentos ou altura de uma escada com `freePath`, o painel grava o campo e em seguida chama `regenStairFree(stairAtualizada, projetoAtualizado, {})` na MESMA transação (`applyStairFreeRegen`); erro de regeneração desfaz o campo (não grava) e vai para a barra de status. Largura: novo campo "Largura do lance" para escada livre, via `{ width }`.
- "Ajustar": seção 8.

## 7. Grips (`packages/tools/src/stairFreeGrips.ts`, irmão de `rampGrips.ts`)

```ts
export interface StairFreeGrip { stairId: Id; index: number; at: Vec2 }
export function stairFreeGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): StairFreeGrip | null; // vértices de escadas com freePath, tolerância 9 · mpp
export function stairFreeHold(env: ToolEnv, g: StairFreeGrip): GripHold;      // arrastar: prévia = componentes antigos tracejados + regenerados; soltar: UMA transação "Mover vértice da escada"
export function stairFreeHandlePreview(p: Project, ids: Id[]): PreviewItem[];  // pontos nos vértices
```

Soltar com erro do motor não grava e mostra "Não é possível mover o vértice: <erro>". Em `selectGrips.ts` o provider `stairFreeGrip` entra ANTES de `stairGrip`; `stairGripAt` (croqui) passa a ignorar escadas com `freePath` (senão arrastar a ponta de uma linha de espelho dessincroniza o trajeto). `selectTool.ts` mostra `stairFreeHandlePreview` no hover, como a rampa.

## 8. Propriedades e Ajustar (apps/web)

- `apps/web/src/editor/stairFreeActions.ts`: `applyStairFreeRegen(store, id, r, label)` (um `updateElements` numa transação com `components`, `freePath`, `manualLandings`), `adjustStairFree(store, id): { message: string } | { error: string }` (monta `optimizeStair` com `measureFreeStair(stair).width`, o trajeto, H e o tipo; regenera com `{ freePath: result.path, fixed: result.fixed }`; transação "Ajustar escada"; devolve `result.note`).
- `StairProperties.tsx`: para uma escada com `freePath`, grupo "Escada livre" com: leitura "Trajeto: N pontos · M lances · K patamares", campo "Largura do lance" (regenera), botão "Ajustar" (`id="p-sadjust"`, classe `chiplink`, `title` = `stair_adjust_title`) e mensagem de status (`role="status"`), exatamente como `RampProperties.tsx` (`adjustMsg`). Escada mista na seleção: grupo oculto.
- `StairRunOptionsBar.tsx`: opção Livre (agora visível), campo "Prof. patamar" em 'free', dica `Escada livre: clique os pontos do trajeto; Enter conclui, A ajusta, Backspace volta.`; "Giro" (turn) fica oculto em 'free'.
- i18n (`apps/web/src/editor/i18n.ts`, pt e en, paridade exigida por `i18n.test.ts`): `stair_shape_free` ('Livre' / 'Free'), `stair_adjust` ('Ajustar' / 'Adjust'), `stair_adjust_title` ('Ajusta o nº de espelhos, a altura e o piso da escada à regra de Blondel do tipo' / 'Adjusts the riser count, riser height and tread to the type Blondel rule'), `stair_free_group` ('Escada livre' / 'Free stair'), `stair_free_path_info` ('Trajeto: {n} pontos · {r} lances · {l} patamares' / 'Path: {n} points · {r} runs · {l} landings'), `stair_free_width` ('Largura do lance' / 'Run width').

## 9. Lista COMPLETA de arquivos por fase

Fase 0 (outro agente, `feat/e-stairfree-model`): `packages/model/src/{stairTypes,stair,stairTransform}.ts` (+ testes), pontos mínimos para compilar.

Fase 1, motor (tarefa-elivre-1):
- Criar: `packages/engine/src/freePathGeom.ts`, `stairLive.ts`, `stairFree.ts` e os testes `freePathGeom.test.ts`, `stairLive.test.ts`, `stairFree.test.ts`, `stairFreeProps.test.ts` (propriedade) e `stairFreeBench.test.ts` (desempenho).
- Alterar: `packages/engine/src/rampFree.ts` (importa do auxiliar), `packages/engine/src/index.ts` (exports de `stairLive`, `stairFree` e nomeados de `freePathGeom`).

Fase 2, ferramenta (tarefa-elivre-2):
- Criar: `packages/tools/src/stairLiveSession.ts`, `stairLiveMessages.ts`, `stairLiveSession.test.ts`, `stairLiveMessages.test.ts`, `stairRunToolFree.test.ts`.
- Alterar: `packages/tools/src/stairRunPlan.ts` (forma 'free', `planStairRunFree`, campos do plano), `stairRunTool.ts` (delegação à sessão, criação, `adjust`), `stairCommands.ts` (só `StairCreateOptions` e `createStairFromComponents`), `stairRunTypes.ts` (se algum `Record<StairRunShape,…>` ou filtro exigir), `packages/tools/src/index.ts` (exports), `apps/web/src/ui/StairRunOptionsBar.tsx`, `packages/tools/src/stairRunTool.test.ts` e `stairRunPlan` testes só se uma expectativa de lista de formas mudar (`STAIR_RUN_SHAPES`).

Fase 3, edição (tarefa-elivre-3):
- Criar: `packages/engine/src/stairFreeEdit.ts` e `stairFreeEdit.test.ts`; `packages/tools/src/stairFreeGrips.ts` e `stairFreeGrips.test.ts`; `apps/web/src/editor/stairFreeActions.ts` e `stairFreeActions.test.ts`.
- Alterar: `packages/engine/src/index.ts` (export de `stairFreeEdit`), `packages/tools/src/selectGrips.ts`, `selectTool.ts`, `stairGrips.ts` (ignorar `freePath`), `stairCommands.ts` (SÓ `updateStairComponents`), `packages/tools/src/index.ts`, `apps/web/src/ui/StairProperties.tsx`, `apps/web/src/editor/i18n.ts`.

Ordem: fase 0 → fase 1 → fases 2 e 3 em paralelo. Conflito previsto: `packages/tools/src/index.ts` e `packages/engine/src/index.ts` (cada tarefa só ACRESCENTA linhas) e `stairCommands.ts` (hunks diferentes).

## 10. Riscos

1. Polígono do patamar com pontos repetidos em θ = 90°, a = b = w/2: `compactRing` + teste com `stairLandingPolygon` (sem `issues`). Se `stairLandingPolygon` recusar anel colinear, remova também o ponto colinear `inner`.
2. `resolveStairs`/sharesRiser: lance antes e depois de patamar não compartilham espelho (cada um tem os seus). Teste confere `riserCount === N` e `riserHeight === H/N` em planos aleatórios.
3. Piso Blondel × espaço do trecho: a folga vai ao patamar (D1); com trechos longos o patamar de entrada pode ficar até `T` mais fundo que o de saída (assimetria visível; aceitável).
4. Dissolver vértice quase colinear desloca o trecho até ~5% em planta: aviso no relatório; o `freePath` mantém o vértice (grip), então regenerar não perde o desenho.
5. Regeneração por propriedades preserva (N, T): mudar o tipo para um de piso diferente mantém T antigo se h ainda couber (decisão D6): botão Ajustar recalcula.
6. Desempenho do `move`: `partsPreview`/`generateStraightRun` por pixel é caro (N linhas). A sessão monta itens por aritmética direta e guarda cache; teste de 2 ms.
7. `findSelfOverlap` usa interseção booleana (`intersection`), só na criação/regeneração/Ajustar (nunca em `move`). No `optimizeStair` roda dezenas de vezes: aceitável (< 200 ms com 10 vértices; teste).
8. Edição à mão do croqui descarta o `freePath` (5.3): comportamento novo; coberto por teste.
9. Escada livre com piso por tipo de caracol não é suportada: `stairTypesForShape('free')` usa os tipos não-caracol (como reta/L/U).
10. Largura mínima do tipo (`minRunWidth`) e patamar mínimo 1,2 m geram AVISOS de norma (nunca bloqueiam), como hoje em L e U.

## 11. Testes obrigatórios

Engine (`freePathGeom`, `stairLive`, `stairFree`):
- `turnLandingRing` com `tIn = tOut` é idêntico, ponto a ponto, ao anel de `turnLanding` da rampa (rampFree.test.ts atual continua verde sem alterar expectativa).
- `compactRing` em θ = 90° (a = b = w/2) devolve 5 pontos (Exemplo 2 acima, em tolerância 1e-9).
- `layoutStairSegment`: Exemplo 1 (n = 16, comprimento 4,20), vão 1,5 → 6 espelhos, H = 3,60 (17 + patamar + 3), regra do resto (M = 17, need = 18, vão grande: o 1º lance teria 17 e sobraria 1, então fica 16 + patamar + 2; com need = 20 não há ajuste: 17 + patamar + 3), `span < T` → vazio, `span = Infinity` com `need` finito.
- `liveStairRemaining`: cursor 3,0 → falta 5; 4,2 → alcançado; 5,0 → passou 2 e `closeAt` 4,2; tolerância em 4,2 − 1e-12.
- `distributeRisers`: Exemplos 2 e 3 (9 + 6 e falta 1; 9 + 0 + 7), fechamento antes do último vão (`closedAt`).
- `fitSegment`: pref, min, pass, short, ponta de trajeto.
- `planStairFree`: Exemplos 1, 2 e 3 com asserções numéricas (nº de lances/patamares, espelhos por lance, `path`, `extended`, `slack`); toda a tabela de bordas da seção 4 (um teste por linha); `manualLandings` em vértice colinear gera retângulo; reta de um trecho tem os mesmos N, h, T de `planStairRun` reta; plano resolve em `resolveStairOne` com `riserCount === N`, `riserHeight ≈ H/N`, sem erro (`severity === 'error'`) e sem `stair-blondel` quando T vem de `treadFor`.
- `optimizeStair`: Exemplo 1 (N = 17, T = 0,3125, gap 0); tipo cuja faixa Blondel é vazia (viola e devolve mensagem); trajeto que obriga a trunca/estica com a nota; nunca devolve plano com erro.
- Propriedade (`stairFreeProps.test.ts`): gerador pseudo-aleatório com semente fixa (mulberry32), 300 trajetos de 2 a 12 vértices, comprimentos de 0,2 a 4 m, ângulos de 0 a 180°, larguras de 0,8 a 1,5 m, H de 1,0 a 4,0 m. Para cada: não lança; ou `{ error }` com mensagem pt-BR ou plano com: soma dos espelhos dos lances = N; todo lance tem n ≥ 2 e n ≤ M; distância entre espelhos consecutivos de cada lance = T (1e-9); sem `findSelfOverlap`; todos os anéis de patamar com área > 0 e sem autointerseção; `riserHeight = H/N`; idempotência (planejar `plan.path` de novo dá os mesmos `parts` até 1e-6); `path` normalizado tem o último ponto no centro do último espelho.
- Extração: os testes existentes de `rampFree`, `rampLive`, `rampEdit` passam sem mudança.

Tools:
- `StairLiveSession`: transições IDLE→ORIGIN→DRAWING→REACHED; Backspace; Esc; concluir com falta (1º `warn`, 2º `done` com `falta`); clique repetido conclui; limite de 40 vértices; dissolução de vértice colinear; recusa de retorno agudo e de trecho curto; `load` restaura o rascunho quando recusa; rótulo ao vivo com os textos exatos (Exemplo 1: cursor a 3,0 m → `16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)`); `configure` com mudança de N/T refaz o cache.
- Desempenho: `move` com 40 vértices confirmados e N = 40, 2000 movimentos: média ≤ 2 ms (mediana; use `performance.now`, `expect(média).toBeLessThan(2)`; sob carga rode isolado). Nenhum `resolveStairs`/`intersection` no `move` (espie `@hestia/engine` ou conte chamadas).
- `StairRunTool` livre: criar L em UMA transação (um passo de desfazer: `store.undo()` remove a escada inteira) com `freePath` gravado e `generatedBy 'free'`; plano recusado mantém o rascunho (`session.points` igual); tecla A (`adjust`) troca N/T e mantém o trajeto; as formas reta/L/U/leque/caracol não mudam (suíte atual verde).

Edição / UI:
- `regenStairFree`: mover vértice atualiza componentes e `freePath`; preserva ids; preserva (N, T) medidos; recalcula N se `H/N > maxRiser`; escada sem `freePath` devolve erro.
- Grips: `stairFreeGripAt` acha vértice; `stairFreeHold` regenera na soltura em UMA transação; recusa não grava; `stairGripAt` ignora escada com `freePath`.
- `adjustStairFree`: transação "Ajustar escada", nota "Ajustado: ...", erro de tipo/altura.
- i18n: paridade pt/en. `StairProperties`: botão Ajustar presente só com `freePath`.
- Edição de croqui descarta `freePath`.
- Suíte completa: `npx vitest run packages apps/web`, `npx tsc --noEmit`, `npx eslint packages apps/web/src` sem regressão.
