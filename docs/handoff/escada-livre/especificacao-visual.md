# Especificação visual: prévias técnicas de escada e rampa, fórmula de Blondel e campos por estilo

Worktree: `wt/integ2`. Caminhos relativos a `apps/web/src` salvo indicação. Lido: `packages/model/src/{stairTypes,rampTypes,ramp,stair}.ts`, `packages/engine/src/{stairGenerators,stairIssues,stairBody}.ts`, `ui/dialogs/Stair*`, `Ramp*`, `stairTypeCalc.ts`, `stairTypeForm.ts`, `stairSectionProfile.ts`, `styles.css`, e as pesquisas `modal-escada-spec.md` e `norma-rampa.md`.

## 0. Diagnóstico e princípios

Problemas atuais: (1) o pé-direito vira um bloco gigante porque a cota usa 2,10 m e o corte tem 3 degraus de ~0,5 m; (2) os rótulos são `<span>` HTML posicionados em % sobre o SVG (`.stt-dim`), sem contorno, sem detecção de colisão, tamanho de fonte fixo em px enquanto o desenho escala; (3) as cotas ficam sobre o preenchimento; (4) a rampa tem 24 linhas, sem cotas, sem planta.

Princípios (valem para escada e rampa):
1. O desenho é DADOS PUROS (`Drawing`), construído por funções sem React, testável em Node. O SVG é só um renderizador burro.
2. Texto é SVG `<text>` com halo (contorno na cor do fundo), tamanho `em` definido no próprio desenho (não em CSS).
3. Cotas e rótulos SEMPRE fora do desenho (faixas/lanes ao redor, alocadas em sequência); chamadas (leaders) podem entrar no desenho.
4. O pé-direito é uma cota vertical QUEBRADA (símbolo de ruptura), comprimento desenhado fixo (3 em), valor real no texto. Nunca bloco.
5. Cores só por TOKENS (`Tone`), mapeados para `var(--...)` no renderizador. Nenhum hex.
6. Um verificador `checkDrawing(d)` (invariantes) é usado nos testes de TODOS os desenhos.

## 1. Tipos (arquivo `ui/schematic/drawing.ts`, tarefa 1)

```ts
export type Pt = readonly [x: number, y: number];          // metros do desenho, y PARA CIMA
export interface Rect { x0: number; y0: number; x1: number; y1: number }  // x0<x1, y0<y1

export type Tone = 'body' | 'ground' | 'guide' | 'muted' | 'accent' | 'ok' | 'warn' | 'danger';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Weight = 'thin' | 'normal' | 'heavy';              // 1, 1.5, 2.2 px (non-scaling-stroke)
export type HatchPattern = 'concrete' | 'ground' | 'wood' | 'diagonal';
export type TextAnchor = 'start' | 'middle' | 'end';
/** body = obstáculo (cota/rótulo nunca sobre ele); aux = guia/figura auxiliar (não é obstáculo). */
export type Role = 'body' | 'aux';

export interface PolygonPrim  { kind: 'polygon';  id: string; pts: Pt[]; fill: 'body' | 'soft' | 'none'; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface PolylinePrim { kind: 'polyline'; id: string; pts: Pt[]; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role; arrowEnd?: boolean }
export interface LinePrim     { kind: 'line';     id: string; a: Pt; b: Pt; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface HatchPrim    { kind: 'hatch';    id: string; pts: Pt[]; pattern: HatchPattern }   // hachura clipada ao polígono
export interface DimensionPrim {
  kind: 'dimension'; id: string;
  p1: Pt; p2: Pt;                       // pontos medidos (na peça)
  axis: 'x' | 'y' | 'aligned';          // x: cota horizontal; y: vertical; aligned: ao longo de p1->p2
  line: number;                         // x: ordenada y da linha de cota; y: abscissa x; aligned: deslocamento perpendicular (+ = à ESQUERDA de p1->p2)
  text: string;                         // pode ter '\n' (até 2 linhas)
  tone: Tone;
  broken?: boolean;                     // true: comprimento desenhado NÃO é o real (símbolo de ruptura no meio); o texto diz o valor
}
export interface LabelPrim { kind: 'label'; id: string; at: Pt; text: string; anchor: TextAnchor; tone: Tone; leader?: Pt }
//   at = ponto de ancoragem: x conforme `anchor`, y = CENTRO vertical do bloco de texto. leader = ponto-alvo; o renderizador
//   liga a borda mais próxima da caixa até ele com fio fino e seta.
export type Prim = PolygonPrim | PolylinePrim | LinePrim | HatchPrim | DimensionPrim | LabelPrim;

export interface Drawing {
  frame: Rect;            // enquadramento (viewBox), já inclui margens e todas as cotas/rótulos
  em: number;             // altura do texto em metros do desenho; largura de 1 caractere = 0.56·em; linha = 1.15·em
  prims: Prim[];          // ordem = ordem de pintura (hachura e corpo primeiro, cotas e rótulos por último)
  caption?: string;       // frase curta mostrada ABAIXO do SVG, em HTML (ex.: "Escala vertical ×4")
  meta: { kind: 'stair-section' | 'ramp-section' | 'ramp-plan'; vExag?: number };
}
```

Regras de composição de ids: `body.*`, `ground.*`, `guide.*`, `dim.*`, `lbl.*`. Ids únicos (teste).

## 2. Geometria e invariantes (`ui/schematic/geometry.ts`, tarefa 1)

Funções puras exportadas (todas com testes):
- `textBox(l: LabelPrim, em): Rect` e `dimTextBox(d: DimensionPrim, em): Rect`. Largura = `0.56·em·(maior linha, em caracteres)`; altura = `1.15·em·nLinhas`. Label: x conforme `anchor`, y centrado em `at.y`.
- `dimGeometry(d, em): { dimLine: [Pt,Pt]; ext1: [Pt,Pt]; ext2: [Pt,Pt]; textAt: Pt; textAnchor: TextAnchor }`:
  - axis x: linha em y=`line` de x1 a x2; extensões verticais de cada ponto até `line` (+0.4·em de ultrapassagem), começando 0.25·em afastadas do ponto (folga). Texto: centro em x médio, y = `line` + s·0.8·em, onde s = +1 se `line` ≥ média de y1,y2 (texto acima) senão −1 (abaixo). Se o texto tem 2 linhas, desloca-se o centro por 0.575·em a mais para fora.
  - axis y: análogo; texto à direita (anchor `start`, x = `line` + 0.6·em) se `line` ≥ média de x1,x2, senão à esquerda (anchor `end`); y centro = média de y1,y2.
  - aligned: n = normal à esquerda de (p2−p1)/|p2−p1|; linha = segmento deslocado `line·n`; extensões de cada ponto até a linha; texto no ponto médio + `sign(line)·0.8·em·n`, anchor `start` se n.x>0.3, `end` se n.x<−0.3, senão `middle`.
- `bboxOf(prims, filter?)`, `rectsOverlap(a,b,eps)`, `rectIntersectsPolygon(rect, pts)`, `pointInPolygonStrict(p, pts, eps)`, `segmentIntersectsRect`, `sampleSegment(a,b,n)`.
- `checkDrawing(d: Drawing): DrawingIssue[]` com `DrawingIssue = { code: string; ids: string[] }`. Códigos e regras (cada um com teste que o provoca):
  1. `text-overlap`: duas caixas de texto (rótulos e textos de cotas) se sobrepõem (margem 0.1·em).
  2. `text-on-body`: caixa de texto intersecta o INTERIOR de polígono com `role==='body'`.
  3. `text-on-guide`: caixa de texto cruza linha/polilinha `role==='aux'` que não seja o `leader` do próprio rótulo.
  4. `dim-on-body`: algum ponto amostrado (n=24) da linha de cota ou das extensões (descartando os primeiros 0.3·em de cada extensão, que ficam na peça) está estritamente dentro de polígono `body`.
  5. `out-of-frame`: caixa de texto, linha de cota ou ponto de primitiva fora de `frame` (tolerância 1e-6).
  6. `font-too-small`: `em / (frame.x1 − frame.x0) < 0.026` (a 360 px de largura o texto teria < 9,4 px).
  7. `dup-id`: ids repetidos.
  8. `dim-inside-bbox` (só dimensões não-aligned e não-broken): linha de cota dentro do retângulo `bboxOf(prims role==='body' ∪ kind 'hatch')`. As cotas "aligned" e as quebradas (pé-direito) são testadas só por `dim-on-body`.
  Sem problemas = `[]`.

## 3. Layout comum (`ui/schematic/lanes.ts`, tarefa 1)

- **em por ponto fixo.** O desenho é construído por `layout(em)`. `em0 = 0.052·W_obstáculos`; repetir até 6 vezes: constrói com `em`, mede `frame.x1−frame.x0 = Wf`, `em ← 0.034·Wf`; para quando a mudança for < 1%. (Margens em múltiplos de `em`, então converge: razão ≈ 0.034·c < 0.85.) Resultado: texto ≈ 12 px com 360 px de largura.
- **LaneStack.** `new LaneStack(obstacle: Rect, em)`; `take(side, extentEm): number` devolve a coordenada da próxima linha de cota livre naquele lado e avança a borda. Regras: primeira linha a `1.6·em` da borda atual; depois de usar, borda = linha ± `(0.6 + extentEm)·em`, onde `extentEm` = largura do texto em em (lados `left`/`right`, texto horizontal para fora) ou altura do texto em em (`top`/`bottom`). A borda inicial de cada lado = lado do `obstacle` (união de corpo, solo, guias). Alocação em ordem sequencial ⇒ não há sobreposição no mesmo lado; o checador cobre os cantos.
- Cotas de comprimento que não cabem entre as extensões (largura do texto > 0.9·vão) vão para uma linha mais externa (outra `take`), nunca empilhadas sobre vizinhas.
- Enquadramento final: `frame = bboxOf(tudo, incluindo caixas de texto e ultrapassagens) expandido por 1·em`.

## 4. Escada: `buildStairSectionDrawing(type, params): Drawing`

Arquivo `ui/dialogs/stairSectionDrawing.ts` (tarefa 2).

```ts
export interface StairDrawingParams {
  riser: number; tread: number;               // m, já calculados (computeStairCalc); inválidos => lança RangeError
  steps?: number;                             // degraus mostrados, padrão 3
  lang?: 'pt' | 'en';                         // padrão 'pt'
  fmt?: (n: number, decimals: number) => string;    // formata um número (o construtor já converteu para cm ou m); padrão pt-BR (vírgula)
}
export function buildStairSectionDrawing(type: StairType, params: StairDrawingParams): Drawing;
```
Textos pt/en ficam em `STAIR_DRAWING_TEXT` no mesmo arquivo (não em `I18N`).

### 4.1 Geometria comum (n=3, R=riser, T=tread, y=0 é o piso inferior)
- Cotas em cm com 1 casa (`fmt(m*100,1)`), pé-direito em m com 2 casas.
- Narizes (cantos frontais): `(i·T, (i+1)·R)`, i=0..n−1. Cantos internos: `(i·T, i·R)`.
- Solo: linha `ground` de `(−0.9·T, 0)` a `(0, 0)` e hachura `ground` no retângulo `[−0.9T,0]×[−0.8·em,0]` (fundo do solo) — polígono `role:'aux'` não, a hachura entra no obstáculo mas não é `body`.
- Guia dos narizes (`guide.pitch`, `dashed`, tom `accent`): `(0,R)` → `((n−1)·T, n·R)`.
- Ângulo θ = atan(R/T) em graus, 1 casa.
- Peça = polígono(s) `role:'body'`, `fill:'body'`, `tone:'body'`, `weight:'normal'`, mais hachura `concrete` (monolítica) ou `wood` (montada, poste) sobre o mesmo polígono.
- Nariz (quando `type.nosing>0` e estilo ≠ poste): retângulo `body.nosing.i` `[iT−nosing, iT]×[(i+1)R−nh, (i+1)R]`, nh = min(0.03, 0.4·R). É informativo (o motor não usa `nosing` na geometria hoje).
- Rótulos/cotas fixos, textos pt (en entre parênteses):

| id | Onde | Texto |
|---|---|---|
| `dim.riser` | esquerda, `axis:'y'`, `p1=(0,0) p2=(0,R)` | `Espelho 18,0 cm` (`Riser 18.0 cm`) |
| `dim.tread` | topo, `axis:'x'`, `p1=(T,2R) p2=(2T,3R)` | `Piso 28,0 cm` (`Tread 28.0 cm`) |
| `lbl.nosing` | esquerda, `at=(bordaEsq−0.6em, 1.45R)`, anchor `end`, `leader=(−nosing/2, R−nh/2)` | `Nariz 1,5 cm` (`Nosing 1.5 cm`) |
| `lbl.theta` | esquerda, `at=(bordaEsq−0.6em, 2.2R)`, anchor `end`, `leader=(T/2, 1.5R)` | `θ = 32,7°` |
| `lbl.floor` | esquerda, abaixo do solo, `at=(−0.9T, −1.6em)` anchor `start` | `Piso inferior` (`Lower floor`) |
| `dim.headroom` | direita, `axis:'y'`, `p1=(2T,n·R)`, `p2=(2T, n·R+3em)`, `broken:true`, tom `danger` | `Pé-direito\nmín. 2,10 m` (`Headroom\nmin. 2.10 m`) |
`bordaEsq` = coordenada x da linha da cota `dim.riser` menos a largura do texto dela; ou seja use `lanes.edge('left')` depois de alocar `dim.riser`. A cota do pé-direito parte do último nariz; sua extensão superior (em `y=n·R+3em`, tom `danger`) faz o papel de linha do teto; na faixa direita ela vem DEPOIS da cota de espessura (mesma abscissa quando possível, empilhada).

### 4.2 Monolítica lisa (`runStyle:'monolithic'`, `undersideStyle:'smooth'`)
Exemplo numérico (tipo padrão com `structuralDepth: 0.12`, R=0.18, T=0.28, n=3, nosing 0.015, headroom 2.10):
- `d=0.12`, `H=hypot(T,R)=0.33287`, `cosθ=T/H=0.84118`, `Tv=d/cosθ=0.14266` (espessura vertical), `x0=Tv·T/R=0.22192`.
- `body.run` polígono (nesta ordem): `(0,0) (0,.18) (.28,.18) (.28,.36) (.56,.36) (.56,.54) (.84,.54) (.84,.39734) (.22192,0)`. O fundo é recortado no piso (y≥0): a laje assenta no solo.
- Espessura estrutural (perpendicular à rampa, medida a partir da linha dos cantos internos): n̂=(R,−T)/H=(.54075,−.84118). `p1=(3T,3R)=(.84,.54)`, `p2=p1+d·n̂=(.90489,.43906)`. `guide.under` = linha tracejada `muted` de `(.84,.39734)` a `p2` (prolonga o fundo da laje). `dim.thick`: `axis:'aligned'`, `p1`, `p2`, `line=+(1.6em)` (à esquerda de p1→p2 = para frente, ao longo da rampa), tom `body`, texto `Espessura estrutural\n12,0 cm ⟂ à rampa` (`Structural thickness\n12.0 cm ⟂ to slope`). Faixa direita, primeira.
- Mock (ASCII; não está em escala):
```
                      Piso 28,0 cm
                     ├──────────┤
                     ┆          ┆                         ┆ Pé-direito
                     ┆          ┆                         ┆ mín. 2,10 m
   θ = 32,7° ╲       ┆          ┆   ┌──── (teto, tracej.) ┆
              ╲_ _ _ ┆_ _ _ _ _ ┆ _ ┘                     ┆
   Nariz 1,5 cm      ┆      ┌───┘◢                        ┆
        ╲            ┆  ┌───┘▒▒▒▒╲ Espessura estrutural   ┴
 ┬       ╲_ _ _ _ _ _┌┘▒▒▒▒▒▒▒▒▒▒▒╲ 12,0 cm ⟂ à rampa
 │ Espelho   ┌───────┘▒▒▒▒▒▒▒▒▒▒▒▒▒▒╲
 │ 18,0 cm   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒╲
 ┴  ═════════╧═════════════════════════╲ _ _ fundo prolongado
 ░░░░░░░░░░ (solo hachurado)
  Piso inferior
```

### 4.3 Monolítica escalonada (`undersideStyle:'stepped'`)
Mesmo que 4.2 (mesmo `dim.thick`, mesmo `guide.under`), exceto o polígono: topo igual e fundo em dentes, `y=max(y,0)`, com `Tv=0.14266`: após `(.84,.54)`: `(.84,.21734) (.56,.21734) (.56,.03734) (.28,.03734) (.28,0)`. (O fundo do dente i é plano a `i·R − Tv`; a linha dos cantos internos dos dentes é a mesma reta de 4.2.) Mock do contorno inferior:
```
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒┐
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒┌─────────┘    dentes de serra
 ▒▒▒▒▒▒▒┌───────┘
 ═══════╧═══════ piso
```

### 4.4 Montada (`runStyle:'assembled'`)
Exemplo: `treadThickness=0.03`, `riserThickness=0.02`, nariz 0.015. 6 polígonos `role:'body'`:
- piso i (`body.tread.i`): `(iT−nosing, (i+1)R−tt) → ((i+1)T+rt, (i+1)R−tt) → ((i+1)T+rt, (i+1)R) → (iT−nosing, (i+1)R)`. i=0: `(−.015,.15) (.30,.15) (.30,.18) (−.015,.18)`.
- espelho i (`body.riser.i`): `(iT, iR) → (iT+rt, iR) → (iT+rt, (i+1)R−tt) → (iT, (i+1)R−tt)`. i=0: `(0,0) (.02,0) (.02,.15) (0,.15)`. i=1: `(.28,.18) (.30,.18) (.30,.33) (.28,.33)`.
- Sem `dim.thick` estrutural nem fundo. Cotas extras:
  - `dim.treadThick` (direita, `axis:'y'`, `p1=((n)T+rt, nR−tt)`, `p2=(nT+rt, nR)`, texto `Piso (espessura)\n3,0 cm`), na mesma linha vertical do pé-direito (empilhadas: espessura abaixo, pé-direito acima).
  - `dim.riserThick` (baixo, `axis:'x'`, `p1=(0,0) p2=(rt,0)`, linha na faixa inferior abaixo do solo, texto `Espelho (espessura) 2,0 cm`).
  - Sem `dim.thick`. A legenda `caption`: `Pisos e espelhos montados sobre estrutura (estrutura não detalhada).`
```
            Piso 28,0 cm
          ├────────┤
        ┌─┴────────┴──┐     (pisos: placas finas sobre espelhos)
   _____│▒▒▒│__    ...
   Nariz └┬──┘ ┌──────
          │▒│  │▒│        espelhos: placas verticais finas
```

### 4.5 Poste (`runStyle:'post'`)
Exemplo: `treadThickness=0.04`, `treadOverlap=0.02`. 3 polígonos `body.tread.i`: `(iT, (i+1)R−tt) → ((i+1)T+ov, (i+1)R−tt) → ((i+1)T+ov, (i+1)R) → (iT,(i+1)R)`. i=0: `(0,.14) (.30,.14) (.30,.18) (0,.18)`. Sem espelho, sem nariz, sem espessura estrutural. Cotas extras: `dim.overlap` (topo, SEGUNDA faixa, `axis:'x'`, `p1=(2T,3R) p2=(2T+ov,3R)`, texto `Sobreposição\n2,0 cm`, cota "curta": texto fora por regra de vão) e `dim.treadThick` na direita (como 4.4). `dim.tread` entre os extremos esquerdos dos degraus 1 e 2. Legenda: `Degraus em balanço presos ao poste central; o corte mostra os degraus desenvolvidos ao longo da linha de caminhada.` Aviso `warn` no canto: nada.
```
        Piso 28,0 cm        Sobreposição 2,0
        ├───────┤           ├┤
               ┌───────┐
      ┌────────┴──┐    ← degraus flutuantes (sem espelho)
 ┌────┴───┐       (vão livre entre eles)
 └────────┘
```

### 4.6 Entradas inválidas
`riser<=0`, `tread<=0` ou não finitos ⇒ `buildStairSectionDrawing` lança `RangeError`; o componente captura e mostra `stt_preview_empty`.

### 4.7 aria-label
`Corte do lance: espelho 18,0 cm, piso 28,0 cm, estilo monolítico (face lisa), ângulo 32,7°` (en equivalente). Gerado no componente, não no desenho.

## 5. Rampa

Arquivo `ui/dialogs/rampSectionDrawing.ts` (tarefa 3).

```ts
export interface RampDrawingParams {
  slope?: number;        // fração; padrão type.defaultSlope
  totalRise?: number;    // m; padrão 1.5 × maxRise da linha da norma (ou 1.2 se não há tabela)
  view: 'section' | 'plan';
  lang?: 'pt' | 'en';
  fmt?: (n: number, decimals: number) => string;
}
export function buildRampSectionDrawing(type: RampType, params: RampDrawingParams): Drawing; // `meta.kind` 'ramp-section' | 'ramp-plan'
```
(O nome pedido `buildRampSectionDrawing` cobre as duas vistas: `view:'section'` e `view:'plan'`.)

### 5.1 Regras de decisão (tipo `nbr9050`: slope=1/12, normTable [5%:1.5, 6.25%:1.0, 8.33%:0.8 (15 lances)], landingMinLength 1.2, structuralDepth 0.15, landingThickness 0.15, defaultWidth 1.5)
- `row = rampNormRowFor(type, slope)` (do modelo). Se `row`=null e tabela não vazia: `overLimit=true` (inclinação acima da norma).
- Lances: `rise_k` = `row.maxRise` para o 1º, e o resto da `totalRise` nos seguintes (cada um ≤ maxRise): `totalRise=1.2` ⇒ `[0.80, 0.40]`. Sem tabela: dois lances iguais de `totalRise/2`.
- Comprimento horizontal do lance `c_k = rise_k / slope` ⇒ `[9.6, 4.8]`. Patamar `P = landingMinLength` (1.2).
- Espessura vertical do lance `tv = structuralDepth·√(1+slope²)` = 0.1505; patamar `lt = landingThickness`.
- **Exagero vertical** `vExag = clamp(round(Ltot / (3.2·(totalRise+tv))), 1, 12)` onde `Ltot = Σc + (n−1)P` (=15.6 ⇒ 15.6/(3.2·1.3505)=3.61 ⇒ vExag=4). Todas as coordenadas y do desenho são multiplicadas por vExag; `meta.vExag=4`; `caption = "Escala vertical ×4 (esquemático)"`.

### 5.2 Corte (view 'section'), coordenadas de desenho (já com y×vExag)
Origem `(0,0)` = piso inferior; `Y(h)=h·vExag`.
- Piso inferior: `ground.low` linha de `(−P,0)` a `(0,0)` + hachura ground abaixo. Piso superior: `ground.high` de `(Ltot, Y(totalRise))` a `(Ltot+P, Y(totalRise))`.
- Lance 1 `body.flight.0`: `(0,0) (9.6, Y(.8)=3.2) (9.6, 3.2−tvY) (0, −tvY)` com `tvY=tv·vExag`; recortado em y≥0 NÃO (a rampa assenta no terreno; hachura ground abaixo do lance não é desenhada). Patamar `body.landing.0`: `(9.6,3.2) (10.8,3.2) (10.8,3.2−ltY) (9.6,3.2−ltY)`. Lance 2 `body.flight.1`: `(10.8,3.2) (15.6,4.8) (15.6,4.8−tvY) (10.8,3.2−tvY)`. Hachura `concrete` sobre cada um.
- Triângulo de inclinação (guia, `role:'aux'`, tom `accent`, `lineStyle:'solid'`, `weight:'thin'`), abaixo do lance 1 a distância `g = 1.2em` do fundo: `P0=(0, −tvY−g)`, `P1=(9.6, P0.y)`, `P2=(9.6, 3.2−tvY−g)`; polilinha fechada `P0→P1→P2→P0`.
  - `dim.run.0` (baixo, `axis:'x'`, p1=(0,0)… use `p1=P0,p2=P1`, linha na faixa inferior, texto `c = 9,60 m`).
  - `dim.rise.0` (direita do triângulo, `axis:'y'`, `p1=P1,p2=P2`, linha em `x=9.6+1.6em`, texto `h = 0,80 m`). É a ÚNICA cota vertical de desnível; os outros desníveis vão em rótulos (abaixo).
  - `lbl.slope` DENTRO do triângulo, `at=(9.6−0.5em, P0.y+1.1em)` anchor `end`, texto `i = h ÷ c = 8,33 % (1:12)` (use `formatRampSlope` do modelo; en: `i = h ÷ c = 8.33 % (1:12)`), tom `accent`. Se a caixa cruzar a hipotenusa, usar `leader` com o rótulo na faixa direita (regra de fallback; o checador acusa `text-on-guide`).
- Níveis (rótulos acima das partes planas): `lbl.level.0` `+0,00` ancorado `end` em `(−0.15em,  1.1em)`; `lbl.level.1` `+0,80` sobre o patamar, `at=(10.2, 3.2+1.2em)` `middle`; `lbl.level.2` `+1,20` sobre o piso superior `at=(Ltot+P/2, 4.8+1.2em)`.
- Rótulos de lance (acima de cada lance, à esquerda da metade, `anchor:'end'`, borda inferior da caixa a `0.4em` acima do topo na metade: a caixa está à esquerda de x_meio, onde o topo é mais baixo, então não toca a laje):
  - `lbl.flight.0`: `Lance 1 · h 0,80 m ≤ 0,80 m (NBR 9050)` tom `ok` (≤ limite) ou `danger` (>). Com `normChecked=false` acrescenta ` · a conferir` (tom `warn`).
  - `lbl.flight.1`: `Lance 2 · h 0,40 m`.
  - `lbl.limit`: se `overLimit`: `Inclinação acima do limite da norma (máx. 8,33 %)` tom `danger`, na faixa superior.
- Patamar: `dim.landing` (baixo, SEGUNDA linha da faixa inferior pois o texto não cabe no vão de 1,2 m, `axis:'x'`, `p1=(9.6,−ltY)`, `p2=(10.8,−ltY)`, texto `Patamar ≥ 1,20 m`). Comprimento total: `dim.total` (baixo, terceira linha, `p1=(0,…) p2=(15.6,…)`, texto `L = 15,60 m`). Lance 2: `dim.run.1` `c = 4,80 m` na primeira linha (junto com `dim.run.0`: cada uma cabe no seu vão).
- Espessura: `dim.thick` (esquerda, `axis:'y'`, `p1=(0,0)`, `p2=(0,−tvY)`, texto `e = 15,0 cm ⟂\n(vertical 15,1 cm)`; mostra a vertical exagerada? NÃO: o texto traz valores reais, a figura exagerada é só visual).
- Pé-direito: `dim.headroom` vertical quebrada no lado direito a partir de `(Ltot, Y(totalRise))`: `Pé-direito livre\nmín. 2,10 m` (tom `danger`), 3em desenhados.
- ASCII (não está em escala; vertical exagerada):
```
                                          Lance 2 · h 0,40 m          +1,20
                    Lance 1 · h 0,80 m ≤ 0,80 m ✓  ______  ┌───────────────  ┬ Pé-direito
                                       _______..---'   ... │       ▒▒▒▒▒▒▒   ┆ livre mín. 2,10 m
   +0,00                         _.--'▒▒▒▒▒▒▒▒▒▒▒▒ +0,80 ┌─┘
  ──────┬────────────────.--'▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒─┘
 e=15cm ┴        ◣  ▒▒▒▒▒▒▒ concreto ▒▒▒▒▒▒▒▒▒▒▒▒▒▒ patamar ▒▒▒▒▒▒▒
          ╲_____◣  ╲ (triângulo de inclinação, abaixo da laje)    │ h = 0,80 m
           i = h ÷ c = 8,33 % (1:12)  ╲_____________________________│
          ├────────── c = 9,60 m ──────────┤├1,2┤├── c = 4,80 m ──┤
                         Patamar ≥ 1,20 m
          ├──────────────────── L = 15,60 m ─────────────────────┤
                      Escala vertical ×4 (esquemático)
```

### 5.3 Planta (view 'plan'): U esquemática, a escala (sem exagero)
Largura `w = defaultWidth` (1.5), patamar de giro profundidade `Pd = max(landingMinLength, w)` (1.5), lances `c1=9.6`, `c2=4.8`.
- `body.flight.0` retângulo `(0,0)-(9.6,1.5)`; `body.landing.0` `(9.6,0)-(11.1,3.0)` (hachura `diagonal`); `body.flight.1` retângulo `(4.8,1.5)-(9.6,3.0)`. Preenchimento `soft`.
- Setas de subida: `guide.arrow.0` polilinha `arrowEnd` tom `accent` de `(0.6,0.75)` → `(10.35,0.75)` → `(10.35,2.25)` → `(5.4,2.25)` (passa pelo patamar; centro do lance).
- Rótulos: `lbl.up` `Sobe` (`Up`) no início da seta; `lbl.land` `Patamar` dentro do patamar NÃO (texto sobre polígono body proibido) ⇒ rótulo na faixa direita com `leader`.
- Cotas: `dim.width` esquerda (`axis:'y'`, `p1=(0,0) p2=(0,1.5)`, `Largura 1,50 m`; se `defaultWidth < minWidth` tom `danger`), `dim.run.0` baixo `c = 9,60 m`, `dim.run.1` topo `c = 4,80 m` (p1=(4.8,3) p2=(9.6,3)), `dim.landing` baixo segunda linha `Patamar ≥ 1,20 m` (`p1=(9.6,0) p2=(11.1,0)`).
- `caption`: `Planta esquemática em U; o giro e o número de lances dependem da rampa criada.`
```
              c = 4,80 m
          ├───────────────┤
     ┌────────────────────┬────┐ ──┐
     │ ◄───────────────┐  │ Pat│   │
 ┌───┴────────────────┐│  │    │   │
 │ Largura 1,50 m     ││  └────┘   │
 │ ──────────────────►┘──┘          
 └────────────────────┴───┘
  ├────── c = 9,60 m ───────┤├1,5┤
```
Para a tabela de norma, o modal já tem a tabela editável; o desenho mostra só a linha que se aplica à inclinação atual.

## 6. Renderizador compartilhado: `SchematicDrawing` (`ui/schematic/SchematicDrawing.tsx`, tarefa 1)

```tsx
export interface SchematicView { id: string; label: string; drawing: Drawing; ariaLabel: string }
export function SchematicDrawing(props: { drawing: Drawing; ariaLabel: string }): ReactElement;
export function SchematicViews(props: { views: SchematicView[]; tabsLabel: string }): ReactElement; // abas "Corte | Planta"
```
- `<svg viewBox="{x0} {-y1} {w} {h}">`, y invertido por transformação `scale(1,-1)` APLICADA SÓ às geometrias (não ao texto); o texto usa `y' = -y` direto para não espelhar. `preserveAspectRatio="xMidYMid meet"`, `width:100%`, `height:auto`, `role="img"`, `aria-label`, `<title>` com o mesmo texto.
- **Tamanho mínimo.** `<svg style={{ minWidth: Math.ceil(10 * W / em) }}>` dentro de `<div style={{ overflowX:'auto' }}>`: garante texto ≥ 10 px; só rola se o painel for estreito demais.
- **Texto com halo.** `<text fontSize={em} paintOrder="stroke" stroke="var(--sheet)" strokeWidth={0.32*em} strokeLinejoin="round" fill={toneVar} fontFamily="var(--font-ui)">`; linhas por `<tspan x dy="1.15em">`.
- **Cotas.** Linha com `vectorEffect="non-scaling-stroke"` `thin`; setas como `<path>` fechados de comprimento `0.7·em` e largura `0.28·em` nas duas pontas (seta para dentro, quando o vão < 2.2·em as setas ficam por fora, apontando para dentro); ticks inexistentes. Quebra (`broken`): dois traços oblíquos de `0.5·em` no meio.
- **Hachuras.** `<pattern>` com id `useId()`; `concrete` = linhas diagonais a 45° espaçadas 0.45·em, tom `muted`, opacidade 0.55, mais pontos; `ground` = diagonais mais espaçadas; `wood` = linhas horizontais a cada 0.35·em; `diagonal` = diagonais finas. Sempre `patternUnits="userSpaceOnUse"` (em unidades do desenho, para escalar com o desenho).
- **Tokens.** `body`→ preenchimento `var(--accent-soft)` e traço `var(--fg)`; `ground`→`var(--fg-faint)`; `guide`→`var(--fg-soft)`; `muted`→`var(--fg-faint)`; `accent`→`var(--accent)`; `ok`→`var(--ok)`; `warn`→`var(--warn)`; `danger`→`var(--danger)`. Fundo da moldura `var(--sheet)`, borda `1px solid var(--line)`. Tema claro/escuro vêm dos tokens (`prefers-color-scheme` e `[data-theme="dark"]` já definem as variáveis em `styles.css`).
- **Legenda.** `caption` em `<p className="stt-ref">` abaixo.
- **Abas** (`SchematicViews`): `role="tablist"`, botões `role="tab"` `aria-selected`, setas esquerda/direita trocam; com 1 vista não mostra abas. Estado local (`useState`), padrão a primeira vista; lembrar a aba em `localStorage` é opcional (`try/catch`).
- Sem dependências novas.

## 7. Cartão "Fórmula de Blondel" (conteúdo; implementação na tarefa 4)

Posição: coluna direita, depois da prévia e da calculadora. Recebe `type` e `heightCm` (a mesma altura da calculadora). Função pura `blondelLive(type, floorToFloor)` em `ui/dialogs/stairBlondel.ts` devolve os números do cartão (usa `computeStairCalc` para o estado).

### 7.1 Textos (pt-BR / en). `{x}` são parâmetros.
- Título: `Fórmula de Blondel` / `Blondel formula`.
- Introdução: `Regra do passo humano (François Blondel, séc. XVII): o espelho e o piso precisam combinar para a escada ser confortável. Quanto maior o espelho, menor deve ser o piso.` / `Rule of the human stride (François Blondel, 17th century): riser and tread must match for a comfortable stair. The taller the riser, the shorter the tread must be.` (origem histórica: a conferir).
- Fórmula do tipo: `{a}·R + {b}·T = {alvo} cm` com simplificação (a=2,b=1 ⇒ `2·R + T = 63,0 cm`). Linha abaixo: `Faixa aceita: de {min} a {max} cm. Fora dela o Hestia só mostra um aviso; nada é bloqueado.` / `Accepted range: {min} to {max} cm. Outside it Hestia only shows a warning; nothing is blocked.`
- Legenda: `R = espelho (altura de cada degrau) · T = piso (profundidade) · a e b = fatores do tipo` / `R = riser (step height) · T = tread (depth) · a and b = type factors`.
- Conta ao vivo, título `Com a altura de {H} cm (calculadora):` / `With a floor-to-floor height of {H} cm (calculator):`
  1. `Nº de espelhos: N = {H} ÷ {maxRiser} (espelho máximo) = {q}; arredonda para cima: N = {N}.` / `Number of risers: N = {H} ÷ {maxRiser} (maximum riser) = {q}; rounded up: N = {N}.`
  2. `Espelho: R = {H} ÷ {N} = {R} cm.` / `Riser: R = {H} ÷ {N} = {R} cm.`
  3. `Piso: T = ({alvo} − {a} × {R}) ÷ {b} = {Traw} cm.` + (se limitado) ` Fica {abaixo do piso mínimo ({min} cm)|acima do piso máximo ({max} cm)}; o Hestia usa {T} cm.` / `Tread: T = ({target} − {a} × {R}) ÷ {b} = {Traw} cm.` + ` That is {below the minimum tread ({min} cm)|above the maximum tread ({max} cm)}; Hestia uses {T} cm.`
  4. Conferência (linha destacada, mono): `{a} × {R} + {b} × {T} = {S} cm` seguida de `✓ dentro de {min} a {max} cm` (tom ok) | `! {d} cm {abaixo|acima} da faixa de {min} a {max} cm; só gera aviso` (warn, diferença ≤ 3 cm) | `✕ {d} cm fora da faixa de {min} a {max} cm; só gera aviso` (danger). Exemplo final: `2 × 17,6 + 28,0 = 63,2 cm ✓ dentro de 63,0 a 65,0 cm`.
  - Todos os números do passo a passo usam R arredondado a 0,1 cm e recomputam T e S a partir dele (a conta fecha na tela). O ESTADO (✓/!/✕) vem de `computeStairCalc` exato; diferença máxima na soma exibida: 0,1 cm.
  - Exemplo completo (tipo padrão, H=300): N=17 (300÷18=16,7); R=17,6; T=(63,0−2×17,6)÷1=27,8 → abaixo do piso mínimo (28,0), usa 28,0; soma 63,2 ✓ (exato 63,29).
- Em palavras (`<details>` aberto por padrão): `Como o Hestia usa: (1) conta o menor número de espelhos que não passa do espelho máximo; (2) divide a altura igualmente entre eles; (3) calcula o piso pela fórmula, sem sair do piso mínimo e do máximo; (4) compara a soma com a faixa e só avisa se sair dela. Nada disso impede você de desenhar do seu jeito: no croqui livre a regra não bloqueia.` / `How Hestia uses it: (1) takes the smallest number of risers that does not exceed the maximum riser; (2) splits the height equally; (3) computes the tread from the formula, within the minimum and maximum tread; (4) compares the sum with the range and only warns when outside. Nothing stops you from drawing your own way: in a free sketch the rule does not block.`
- Nota por estilo/forma (`note`, abaixo):
  - Monolítica e montada, lance reto: `Vale no lance reto.`
  - Escada caracol ou em leque (qualquer estilo, quando o lance é curvo) e estilo poste: `Em caracol e leque o piso muda com o raio. O Hestia confere o piso médio do lance (medido na linha de caminhada) e usa a regra do caracol nos avisos; aqui a conta mostra o lance reto de referência.` / `In spiral and winder stairs the tread changes with the radius. Hestia checks the mean tread of the flight (measured on the walking line) and uses the spiral rule in warnings; the calculation here shows the straight reference flight.` Para `runStyle==='post'` o parágrafo vem em destaque (`stt-ref` forte); sem poste só a nota curta.
- Predefinições (`<details>` fechado "O que significam as predefinições"):
  | Predefinição | O que aplica | Origem |
  |---|---|---|
  | Padrão Hestia | `2R + T`, alvo 63, faixa 63 a 65 cm; espelho máx. 18, piso mín. 28 / máx. 32, largura 80 cm | Padrão do produto (`DEFAULT_STAIR_CALC_RULE`), faixa herdada da NBR 9050 |
  | NBR 9050 | faixa 63 a 65 cm; espelho 16 a 18, piso 28 a 32 (aplica máx. 18, mín. 28, máx. 32), largura 120 cm | Fonte secundária; a conferir na norma vigente |
  | NBR 9077 | faixa 63 a 64 cm; espelho 16 a 18, piso 28 a 32, largura 110 cm | Fonte secundária; a conferir (saídas de emergência) |
  | IBC | espelho máx. 7 pol (17,8 cm), piso mín. 11 pol (27,9 cm), largura 44 pol (111,8 cm). O IBC NÃO tem fórmula de soma; a faixa 60 a 65 cm é só uma aproximação do "Stair Calculator" do Revit usada pelo Hestia | Código internacional; aproximação do Hestia, a conferir |
  Rodapé: `Valores de referência. Confira a norma vigente antes de usar.`
- Chaves i18n: prefixo `stt_bl_` (ver tarefa 4).

## 8. Matriz de aplicabilidade (estilo × campo)

`S` = aparece e é editável; `–` = oculto (o valor fica guardado; só grava 0 nos não aplicáveis no `upsert` final, como o modelo exige); `i` = aparece com nota. Fontes: `stairBody.ts` (monolítica = laje; montada = `treadThickness` + `riserThickness` + `landingThickness`; poste = `treadThickness` + `treadOverlap`), `stairQuantities.ts`, `stairIssues.ts`.

| Campo (StairType) | Rótulo pt-BR | Monolítica | Montada | Poste | Por quê |
|---|---|---|---|---|---|
| name, code, description, cost | Nome, Código, Descrição, Custo | S | S | S | identificação |
| runStyle | Estilo | S | S | S | |
| materialId | Material (do lance / dos pisos e espelhos / dos degraus) | S | S | S | rótulo muda por estilo |
| postMaterialId | Material do poste | – | – | S | só o poste tem poste |
| maxRiser | Espelho máximo | S | S | S | define N |
| minTread | Piso mínimo (no poste: na linha de caminhada) | S | S | i | no poste é medido na linha de caminhada |
| minRunWidth | Largura mínima do lance | S | S | S | aviso de largura |
| minHeadroom | Pé-direito livre mínimo | S | S | S | furo da laje no modo "pé-direito" |
| nosing | Nariz | S | S | – | só 3D/quantitativo; o poste não tem nariz de espelho; hoje o motor ainda não usa o nariz na geometria (nota na ajuda) |
| calcRiserFactor, calcTreadFactor, calcTarget, calcMin, calcMax, maxTread, predefinição | Fórmula de Blondel e limites | S | S | i | `stairIssues.runChecks` avisa em qualquer estilo; no poste a conta vale na linha de caminhada (nota) |
| structuralDepth | Espessura estrutural (⟂ à rampa) | S | – | – | só a laje monolítica |
| undersideStyle | Face inferior (lisa/escalonada) | S | – | – | só a laje monolítica |
| treadThickness | Espessura do piso (no poste: do degrau) | – | S | S | monolítica não tem peça de piso |
| riserThickness | Espessura do espelho | – | S | – | o poste não tem espelho |
| treadOverlap | Sobreposição dos degraus | – | – | S | só o poste sobrepõe degraus |
| landingThickness | Espessura do patamar | – | S | – | monolítica: o patamar usa o fundo do lance; poste: não tem patamar (`stairQuantities`) — conferir com o dono |
Ajustes de UI associados: a preservação dos valores ocultos ao trocar de estilo já existe (`preserveOnStyleChange` em `StairTypeDialog.tsx`); não mexer. A prévia do poste passa a receber R e T da calculadora (hoje `StairTypeDialog` não passa no poste). Fórmula do cartão e da calculadora no poste: ver 7.1 nota.

## 9. Layout do modal (escada e rampa)

- Janela larga: `min(1040px, 96vw)` por `min(92vh, 860px)`; corpo em grade `auto auto 1fr` (cabeçalho do tipo, nome, conteúdo); o conteúdo ocupa TODA a altura restante (outro agente corrige o CSS: a caixa de texto não chega ao fim da janela).
- Duas colunas que preenchem a janela inteira: `grid-template-columns: minmax(0,1.25fr) minmax(360px,1fr)`; cada coluna rola sozinha (`overflow:auto; min-height:0`). Abaixo de 820px, uma coluna.
- Coluna esquerda: seções 1 a 5 existentes (campos filtrados por estilo; seção 2 com a ajuda curta da fórmula e a predefinição).
- Coluna direita, de cima para baixo: (1) Prévia do corte (`SchematicViews`, cartão com borda, altura natural, sem `max-height`); (2) Calculadora (altura, N, R, T, extensão, ângulo); (3) Cartão de Blondel (conta ao vivo e explicação).
- Rampa: mesma grade; coluna direita = `SchematicViews` com abas `Corte | Planta`, a legenda e o cartão de norma da linha atual; coluna esquerda = campos e tabela de norma.
- Largura mínima da prévia = 360px; o renderizador cuida do resto.

## 10. Ordem, riscos e decisões

Ordem: tarefa 1 (renderizador, tipos, verificador) antes das 2 e 3; a 4 é independente (não importa o desenho); 2 e 3 podem ir em paralelo depois da 1. Conflitos de arquivo: ver cada tarefa (a 4 é a única que toca `i18n.ts`, `StairTypeSections.tsx`, `StairCalculatorPanel.tsx` e `StairTypeDialog.tsx`; a 2 toca `StairSectionPreview.tsx`; a 3 toca `RampSectionPreview.tsx`). Ninguém toca `styles.css` (a classe `.stt-dim` fica morta; limpeza depois do outro agente do CSS).

Riscos: (a) o ponto fixo do `em` e o verificador de colisões são a parte mais difícil para um modelo menos capaz; a tarefa 1 traz casos numéricos; (b) a espessura "perpendicular" na escalonada foi interpretada como distância entre a linha dos cantos internos e a linha do fundo dos dentes; (c) NBR 9050/9077/IBC ficam "a conferir"; (d) `nosing` ainda não entra na geometria do motor; (e) no poste, a soma de Blondel é só aviso na linha de caminhada: decisão a confirmar com o dono se esses campos devem aparecer (aqui: aparecem, com nota).
