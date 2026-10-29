# Tarefa visual 1: tipos do desenho, verificador, lanes e componente `SchematicDrawing` (rodar ANTES das tarefas 2 e 3)

Modelo executor: DeepSeek flash. Siga os passos na ordem. Não invente nada fora deste texto. Leia também, como referência, as seções 1, 2, 3 e 6 de `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\especificacao-visual.md`.

## Contexto
Projeto Hestia (React + TypeScript), worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2`, app em `apps/web/src`. As prévias de corte de escada e rampa serão refeitas como desenhos técnicos. Esta tarefa cria a BASE comum: tipos do desenho (puros, sem React), geometria, verificador de invariantes, alocador de faixas de cota e o componente SVG que desenha qualquer `Drawing`. As tarefas 2 e 3 vão importar o que você criar, então os NOMES e ASSINATURAS abaixo são obrigatórios.

## Arquivos que você PODE criar (todos novos)
- `apps/web/src/ui/schematic/drawing.ts` (só tipos e constantes)
- `apps/web/src/ui/schematic/geometry.ts`
- `apps/web/src/ui/schematic/lanes.ts`
- `apps/web/src/ui/schematic/SchematicDrawing.tsx`
- `apps/web/src/ui/schematic/geometry.test.ts`, `lanes.test.ts`, `renderSchematic.test.ts` (teste do componente por renderização para string, ver abaixo)
## Arquivos que você NÃO pode tocar
Qualquer arquivo existente (em especial `styles.css`, `i18n.ts`, `StairTypeDialog.tsx`, `RampTypeDialog.tsx`, `*SectionPreview.tsx`, `stairSectionProfile.ts`). Sem novas dependências no `package.json`.

## 1. `drawing.ts`: copie EXATAMENTE estes tipos
```ts
export type Pt = readonly [x: number, y: number];
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export type Tone = 'body' | 'ground' | 'guide' | 'muted' | 'accent' | 'ok' | 'warn' | 'danger';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Weight = 'thin' | 'normal' | 'heavy';
export type HatchPattern = 'concrete' | 'ground' | 'wood' | 'diagonal';
export type TextAnchor = 'start' | 'middle' | 'end';
export type Role = 'body' | 'aux';
export interface PolygonPrim  { kind: 'polygon';  id: string; pts: Pt[]; fill: 'body' | 'soft' | 'none'; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface PolylinePrim { kind: 'polyline'; id: string; pts: Pt[]; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role; arrowEnd?: boolean }
export interface LinePrim     { kind: 'line';     id: string; a: Pt; b: Pt; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface HatchPrim    { kind: 'hatch';    id: string; pts: Pt[]; pattern: HatchPattern }
export interface DimensionPrim { kind: 'dimension'; id: string; p1: Pt; p2: Pt; axis: 'x' | 'y' | 'aligned'; line: number; text: string; tone: Tone; broken?: boolean }
export interface LabelPrim { kind: 'label'; id: string; at: Pt; text: string; anchor: TextAnchor; tone: Tone; leader?: Pt }
export type Prim = PolygonPrim | PolylinePrim | LinePrim | HatchPrim | DimensionPrim | LabelPrim;
export interface Drawing {
  frame: Rect; em: number; prims: Prim[]; caption?: string;
  meta: { kind: 'stair-section' | 'ramp-section' | 'ramp-plan'; vExag?: number };
}
export interface DrawingIssue { code: string; ids: string[] }
export const CHAR_W = 0.56;   // largura de 1 caractere, em múltiplos de em
export const LINE_H = 1.15;   // altura de 1 linha de texto, em múltiplos de em
export const MIN_FONT_RATIO = 0.026;
```
Significado: coordenadas em metros do desenho, y PARA CIMA. `DimensionPrim.line`: axis `'x'` = ordenada y da linha de cota (cota horizontal); `'y'` = abscissa x (cota vertical); `'aligned'` = deslocamento perpendicular, positivo à ESQUERDA de p1→p2. `LabelPrim.at`: x conforme `anchor`, y = CENTRO vertical do bloco de texto; `leader` = ponto-alvo de uma chamada.

## 2. `geometry.ts`: funções puras (exporte todas)
```ts
export function textLines(text: string): string[];                    // text.split('\n')
export function labelBox(l: LabelPrim, em: number): Rect;
export function dimTextBox(d: DimensionPrim, em: number): Rect;
export interface DimGeometry { dimLine: [Pt, Pt]; ext1: [Pt, Pt]; ext2: [Pt, Pt]; textAt: Pt; textAnchor: TextAnchor }
export function dimGeometry(d: DimensionPrim, em: number): DimGeometry;
export function bboxOf(prims: Prim[], filter?: (p: Prim) => boolean): Rect;     // pontos das primitivas (sem caixas de texto); lança RangeError se vazio
export function expandRect(r: Rect, by: number): Rect;
export function rectsOverlap(a: Rect, b: Rect, eps?: number): boolean;           // sobreposição com área > 0 (eps encolhe os retângulos)
export function pointInPolygonStrict(p: Pt, poly: readonly Pt[], eps: number): boolean; // dentro e a mais de eps da borda
export function rectIntersectsPolygonInterior(r: Rect, poly: readonly Pt[], eps: number): boolean;
export function segmentIntersectsRect(a: Pt, b: Pt, r: Rect): boolean;
export function sampleSegment(a: Pt, b: Pt, n: number): Pt[];                    // n+1 pontos incluindo as pontas
export function checkDrawing(d: Drawing): DrawingIssue[];
```
Regras exatas:
- `labelBox`: `w = CHAR_W*em*maxChars`, `h = LINE_H*em*nLinhas`. anchor `start`: x de `at.x` a `at.x+w`; `end`: de `at.x-w` a `at.x`; `middle`: centrado. y de `at.y-h/2` a `at.y+h/2`.
- `dimGeometry` (e = em):
  - `axis:'x'`: `dimLine=[(x1,line),(x2,line)]` (x1=p1.x, x2=p2.x); `ext1=[(x1, p1.y + s1*0.25e),(x1, line + s1*0.4e)]` onde `s1 = sinal(line - p1.y)` (se 0, use +1); `ext2` igual com p2. `textAnchor:'middle'`; `sg = sinal(line - (p1.y+p2.y)/2)` (0 vira +1); `textAt = ((x1+x2)/2, line + sg*(0.8e + (linhas-1)*0.575e))`.
  - `axis:'y'`: simétrico: `dimLine=[(line,y1),(line,y2)]`; ext1 horizontal de `(p1.x + s*0.25e, y1)` até `(line + s*0.4e, y1)`; texto: `sg = sinal(line - (p1.x+p2.x)/2)`; `textAnchor = sg>0 ? 'start':'end'`; `textAt = (line + sg*0.6e, (y1+y2)/2)`.
  - `axis:'aligned'`: `u = (p2-p1)/|p2-p1|`; `n = (-u.y, u.x)` (normal à esquerda); `dimLine=[p1+line*n, p2+line*n]`; `ext1=[p1+sg*0.25e*n, p1+line*n+sg*0.4e*n]` (sg=sinal(line), 0 vira +1), idem ext2; `sg*n.x>0.3 → 'start'`, `<-0.3 → 'end'`, senão `'middle'`; `textAt = (meio das duas pontas da dimLine) + sg*(0.8e + (linhas-1)*0.575e)*n` (para anchor start/end use `0.6e` em vez de `0.8e`).
  - `dimTextBox` = caixa do texto com `textAt`/`textAnchor` e a mesma largura/altura de `labelBox`.
- `checkDrawing(d)` devolve a lista de problemas (códigos exatos):
  1. `text-overlap`: duas caixas de texto (rótulos + cotas, 2 a 2) com `rectsOverlap(a,b,0.1*em)`; `ids` = [idA,idB].
  2. `text-on-body`: caixa de texto × polígono `role==='body'` com `rectIntersectsPolygonInterior(box, pts, 1e-6)`.
  3. `text-on-guide`: caixa de texto × `line`/`polyline` com `role==='aux'` via `segmentIntersectsRect` em cada segmento, ignorando um rótulo contra o PRÓPRIO leader (o leader não é primitiva; ele só vai ser desenhado pelo renderizador, então este caso nem precisa tratamento).
  4. `dim-on-body`: para cada cota, amostrar (n=24) `dimLine` e, em cada extensão, os pontos a mais de `0.3*em` da ponta inicial; se algum ponto estiver `pointInPolygonStrict(p, poly, 1e-6)` de um polígono `body`, reportar `[idCota, idPolígono]`.
  5. `out-of-frame`: qualquer caixa de texto, ponta de linha de cota ou ponto de primitiva fora de `d.frame` (tolerância 1e-6).
  6. `font-too-small`: `d.em / (frame.x1-frame.x0) < MIN_FONT_RATIO`.
  7. `dup-id`: ids repetidos (`ids` = os repetidos).
  8. `dim-inside-bbox`: cotas com `axis` ≠ `'aligned'` e sem `broken`, cuja `dimLine` caia dentro do `bboxOf(prims role body ou kind hatch)` (interior estrito).

## 3. `lanes.ts`
```ts
export type Side = 'left' | 'right' | 'top' | 'bottom';
export class LaneStack {
  constructor(obstacle: Rect, em: number);
  /** Coordenada da próxima linha de cota livre no lado (x para left/right, y para top/bottom). Avança a borda. */
  take(side: Side, extentEm: number): number;
  /** Borda atual (coordenada) do lado, depois das alocações. */
  edge(side: Side): number;
  /** Informa uma borda ocupada por algo que não passou por take (ex.: caixa de texto). */
  reserve(side: Side, coord: number): void;
}
export function solveEm(build: (em: number) => Drawing, em0: number, iterations?: number): Drawing;
```
- `take`: `line = edge ± 1.6*em` (left/bottom: menos; right/top: mais); depois `edge = line ± (0.6+extentEm)*em` na mesma direção. Retorna `line`.
- `solveEm`: `em = em0`; repetir até `iterations` (padrão 6): `d = build(em)`; `W = d.frame.x1 - d.frame.x0`; `next = 0.034*W`; parar se `abs(next-em)/em < 0.01`; senão `em = next`. Devolve o último `d`.

## 4. `SchematicDrawing.tsx`
```tsx
export interface SchematicView { id: string; label: string; drawing: Drawing; ariaLabel: string }
export function SchematicDrawing(props: { drawing: Drawing; ariaLabel: string }): ReactElement
export function SchematicViews(props: { views: SchematicView[]; tabsLabel: string }): ReactElement
export const TONE_VAR: Record<Tone, string>   // 'body'→'var(--fg)', 'ground'→'var(--fg-faint)', 'guide'→'var(--fg-soft)', 'muted'→'var(--fg-faint)', 'accent'→'var(--accent)', 'ok'→'var(--ok)', 'warn'→'var(--warn)', 'danger'→'var(--danger)'
```
Requisitos (cada um tem teste):
1. Raiz: `<div>` com `border:1px solid var(--line)`, `background:var(--sheet)`, `borderRadius:2`, `overflowX:'auto'`. Dentro `<svg>`: `viewBox={`${x0} ${-y1} ${w} ${h}`}` (w=x1-x0, h=y1-y0), `width:'100%'`, `height:'auto'`, `preserveAspectRatio="xMidYMid meet"`, `role="img"`, `aria-label`, `<title>` com o mesmo texto, `style={{ display:'block', minWidth: Math.ceil(10*w/em) }}` (garante texto ≥ 10 px).
2. Converta y do desenho para SVG com `Y = -y` em TODA coordenada (não use `scale(1,-1)`, para o texto não espelhar).
3. Cores: nenhum literal de cor (`#`, `rgb`). Preenchimento `fill:'body'` → `var(--accent-soft)`, `'soft'` → `var(--accent-soft)` com `fillOpacity={0.5}`, `'none'` → `none`. Traço pela `TONE_VAR[tone]`. Pesos: thin=1, normal=1.5, heavy=2.2, todos com `vectorEffect="non-scaling-stroke"`. `dashed` → `strokeDasharray="6 4"`, `dotted` → `"1.5 3"`.
4. Texto (rótulos e cotas): `<text fontSize={em} fill=... paintOrder="stroke" stroke="var(--sheet)" strokeWidth={0.32*em} strokeLinejoin="round" fontFamily="var(--font-ui)" textAnchor=... >`; cada linha de `text.split('\n')` é um `<tspan x=... dy=...>`; o bloco é centrado verticalmente em `y` (primeira linha em `y - (n-1)*0.575*em` e `dominantBaseline="central"`).
5. Cotas: desenhe `dimLine`, `ext1`, `ext2` de `dimGeometry`, cor `TONE_VAR[tone]` (cota `tone:'body'` vira `guide` na cor para ficar mais discreta que o desenho), peso thin. Setas: `<path>` preenchido, comprimento `0.7*em`, largura total `0.28*em`, uma em cada ponta de `dimLine`, apontando para fora da linha em direção ao ponto medido (ou seja, a ponta encosta no fim da linha). Se `|dimLine| < 2.2*em`, desenhe as setas por fora (apontando para dentro). `broken`: dois traços oblíquos de comprimento `0.5*em` no meio da `dimLine`, afastados `0.3*em` um do outro, perpendiculares à linha inclinados 45°.
6. Rótulo com `leader`: linha fina de `TONE_VAR[tone]` do ponto da borda da caixa mais próximo do `leader` até o `leader`, com uma seta pequena (mesma geometria) na ponta do leader.
7. `polyline.arrowEnd`: seta de `0.9*em` no último segmento.
8. Hachuras: `<pattern id={...}>` com ids de `useId()` (troque `:` por `_`) + prefixo do `prim.id`; `patternUnits="userSpaceOnUse"`; tamanhos em múltiplos de `em`: `concrete` = diagonais 45° a cada `0.45*em` + um ponto de raio `0.05*em` no meio, `stroke var(--fg-faint)` opacidade 0.55; `ground` = diagonais a cada `0.7*em`, `var(--fg-faint)`; `wood` = linhas horizontais a cada `0.35*em`, `var(--fg-faint)` opacidade 0.5; `diagonal` = diagonais a cada `0.5*em`, `var(--fg-faint)`. O `<polygon fill="url(#id)">` da hachura vem DEPOIS do polígono do corpo.
9. Ordem de pintura: respeite `prims` na ordem, mas desenhe todo texto de cotas e rótulos por último (halo nunca fica escondido).
10. `caption`: `<p className="stt-ref" style={{margin:'4px 0 0'}}>{caption}</p>` abaixo da raiz.
11. `SchematicViews`: se `views.length===1`, só o `SchematicDrawing`. Senão `role="tablist"` (`aria-label={tabsLabel}`) com `<button role="tab" aria-selected id=... aria-controls=...>` e painel `role="tabpanel"`. Estado `useState` com o id da primeira vista; setas esquerda/direita mudam a aba (`onKeyDown`); botões com classe `btn small` e `aria-selected` refletido em `className` extra `primary` na ativa.

## 5. Testes (vitest; `npx vitest run apps/web`)
Os testes de componente devem ser SEM navegador: use `renderToStaticMarkup` de `react-dom/server`. Se o ambiente de teste do `apps/web` não for node/jsdom, rode com `// @vitest-environment node` no topo do arquivo `renderSchematic.test.ts`.

`geometry.test.ts` (construa os desenhos de teste à mão, `em = 0.05`):
- `labelBox` com `text:'Piso 28,0 cm'` (12 caracteres), `anchor:'start'`, `at:[1,2]`: `x0=1`, `x1=1+0.56*0.05*12=1.336`, altura 0.0575 centrada em y=2 (`y0=1.97125`, `y1=2.02875`). Com `'end'` x1=1; com `'middle'` centrado em 1. Duas linhas `'ab\ncdef'`: largura 4 caracteres, altura `2*1.15*em`.
- `dimGeometry` axis x: `p1=[0,0.18]`, `p2=[0.28,0.36]`, `line=0.66`: `dimLine=[[0,0.66],[0.28,0.66]]`; `ext1=[[0,0.18+0.0125],[0,0.66+0.02]]`; `textAnchor 'middle'`; `textAt=[0.14, 0.66+0.04]`.
- axis y: `p1=[0,0]`, `p2=[0,0.18]`, `line=-0.11`: `dimLine=[[-0.11,0],[-0.11,0.18]]`; texto à esquerda: `textAnchor 'end'`, `textAt=[-0.11-0.03, 0.09]`.
- axis aligned: `p1=[0.84,0.54]`, `p2=[0.90489,0.43906]`, `line=0.08`: `u=(0.5408,-0.8412)` (aprox.), `n=(0.8412,0.5408)`; `dimLine[0]` ≈ `[0.84+0.0673, 0.54+0.0433]` (toBeCloseTo 3 casas); `textAnchor 'start'`.
- `pointInPolygonStrict` com o quadrado unitário: `[0.5,0.5]` true; `[1,0.5]` (na borda) false; `[2,2]` false.
- `checkDrawing` positivo e um teste por código (monte o desenho mínimo que provoca): (a) dois rótulos sobrepostos → `text-overlap`; (b) rótulo no interior de um polígono body → `text-on-body`; (c) cota `axis:'y'` com linha dentro de polígono → `dim-on-body`; (d) rótulo fora do frame → `out-of-frame`; (e) `em` pequeno (`em=0.001`, frame de largura 1) → `font-too-small`; (f) ids repetidos → `dup-id`; (g) cota `axis:'x'` com `line` dentro do bbox do corpo → `dim-inside-bbox`. E um desenho válido (retângulo body `[0,0]-[1,1]`, uma cota `axis:'x'` em `line=1.3`, `p1=[0,1] p2=[1,1]`, `em=0.05`, frame `{x0:-0.5,y0:-0.5,x1:1.8,y1:1.8}`) devolve `[]`.
`lanes.test.ts`: `new LaneStack({x0:0,y0:0,x1:1,y1:0.5}, 0.05)`: `take('left', 8)` = `-0.08`; `edge('left')` depois = `-0.08 - (0.6+8)*0.05 = -0.51`; segundo `take('left', 8)` = `-0.51-0.08 = -0.59`. `take('top',1.15)` = `0.5+0.08=0.58`; `take('right',0)`=`1.08`. `solveEm`: com um `build` que devolve frame de largura `2 + 10*em` e `em` dado, o resultado converge para `em ≈ 0.034*(2+10*em)` → `em ≈ 0.0687` (toBeCloseTo, 3 casas).
`renderSchematic.test.ts`: renderize um `Drawing` de teste e verifique na string: contém `viewBox="-0.5 -1.8 2.3 2.3"` (use um frame que gere esse valor), contém `role="img"` e o `aria-label`; NÃO contém `#` seguido de 3 ou 6 hex nem `rgb(`; contém `var(--sheet)` (halo); contém `paint-order="stroke"`; contém `<pattern` para um desenho com hachura; `SchematicViews` com 2 vistas contém `role="tablist"` e dois `role="tab"`, com 1 vista não contém `role="tablist"`; `style` do svg contém `min-width:`.

## 6. Comandos obrigatórios, nesta ordem, todos sem erro
```
cd C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2
npx vitest run apps/web
npx tsc --noEmit
npx eslint apps/web/src
```
## 7. Critérios de aceite
- Todos os nomes e assinaturas acima existem e são exportados.
- Todos os testes novos passam; nenhum teste antigo quebra; `tsc` e `eslint` sem erros novos.
- Nenhuma cor literal nos arquivos `.tsx`.
- Nenhum arquivo existente alterado (`git status` mostra só arquivos novos em `apps/web/src/ui/schematic/`).
## 8. Commit
`git add apps/web/src/ui/schematic && git commit -m "feat(web): base de desenho técnico esquemático (tipos, verificador, faixas de cota e SchematicDrawing)"` seguido da linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` no corpo. NÃO fazer push.

## RELATÓRIO FINAL (obrigatório, até 15 linhas)
Liste: arquivos criados; funções exportadas; resultado de `vitest`, `tsc`, `eslint` (copie a última linha de cada); qualquer desvio das fórmulas acima e por quê; dúvidas para o arquiteto.
