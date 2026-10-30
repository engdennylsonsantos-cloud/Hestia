# Tarefa visual 2: `buildStairSectionDrawing` + nova `StairSectionPreview` (depende da tarefa 1)

Modelo executor: DeepSeek flash. PRÉ-REQUISITO: a tarefa 1 está commitada (existe `apps/web/src/ui/schematic/{drawing,geometry,lanes}.ts` e `SchematicDrawing.tsx`). Confira com `git log --oneline -5` e `ls apps/web/src/ui/schematic`. Se não existir, PARE e avise no relatório.
Referência: `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\especificacao-visual.md` seções 1 a 4 (leia, os mocks ASCII estão lá).

## Contexto
Worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2`, app em `apps/web/src`. A prévia de corte do modal de TIPO de escada (`ui/dialogs/StairSectionPreview.tsx`) tem rótulos HTML soltos e o pé-direito como bloco. Você cria o MODELO DE DESENHO puro `buildStairSectionDrawing` (sem React) e troca a prévia para usar `SchematicViews` da tarefa 1. Tipos do modelo: `import type { StairType } from '@hestia/model'` (campos usados: `runStyle: 'monolithic'|'assembled'|'post'`, `undersideStyle: 'smooth'|'stepped'`, `structuralDepth`, `treadThickness`, `riserThickness`, `treadOverlap`, `nosing`, `minHeadroom`, todos em metros). Tipos do desenho: `Drawing`, `Prim`, etc. de `../schematic/drawing.ts`; helpers `bboxOf`, `expandRect`, `labelBox`, `dimTextBox`, `checkDrawing` de `../schematic/geometry.ts`; `LaneStack`, `solveEm` de `../schematic/lanes.ts`; constantes `CHAR_W`, `LINE_H` de `drawing.ts`.

## Arquivos que você PODE criar/editar
- criar `apps/web/src/ui/dialogs/stairSectionDrawing.ts`
- criar `apps/web/src/ui/dialogs/stairSectionDrawing.test.ts`
- reescrever `apps/web/src/ui/dialogs/StairSectionPreview.tsx` (manter o nome do componente e as props `{ type: StairType; riser?: number; tread?: number }`)
## NÃO tocar
`stairSectionProfile.ts` e seu teste (continuam como estão), `StairTypeDialog.tsx`, `StairTypeSections.tsx`, `StairCalculatorPanel.tsx`, `styles.css` (a classe `.stt-dim` fica sem uso, é esperado), `editor/i18n.ts` (os textos do desenho ficam em constantes dentro do seu arquivo), qualquer arquivo de `ui/schematic/`.

## API obrigatória
```ts
export interface StairDrawingParams {
  riser: number; tread: number;                 // m
  steps?: number;                               // padrão 3
  lang?: 'pt' | 'en';                           // padrão 'pt'
  fmt?: (n: number, decimals: number) => string; // padrão: pt-BR com vírgula (n.toFixed(d).replace('.', ','))
}
export function buildStairSectionDrawing(type: StairType, params: StairDrawingParams): Drawing;
export interface StairDrawingText { riser: string; tread: string; nosing: string; theta: string; floor: string; headroom: string; thick: string; treadThick: string; riserThick: string; overlap: string; capMono: string; capAssembled: string; capPost: string }
export const STAIR_DRAWING_TEXT: Record<'pt' | 'en', StairDrawingText>;
```
Textos (use `{v}` como espaço do número; o construtor troca):
pt: riser `Espelho {v} cm`; tread `Piso {v} cm`; nosing `Nariz {v} cm`; theta `θ = {v}°`; floor `Piso inferior`; headroom `Pé-direito\nmín. {v} m`; thick `Espessura estrutural\n{v} cm ⟂ à rampa`; treadThick `Piso (espessura)\n{v} cm` ; riserThick `Espelho (espessura) {v} cm`; overlap `Sobreposição\n{v} cm`; capMono `Corte esquemático de {n} degraus. Cotas em cm.`; capAssembled `Pisos e espelhos montados sobre estrutura (estrutura não detalhada).`; capPost `Degraus em balanço presos ao poste central, desenvolvidos ao longo da linha de caminhada.`
en: `Riser {v} cm`; `Tread {v} cm`; `Nosing {v} cm`; `θ = {v}°`; `Lower floor`; `Headroom\nmin. {v} m`; `Structural thickness\n{v} cm ⟂ to slope`; `Tread (thickness)\n{v} cm`; `Riser (thickness) {v} cm`; `Overlap\n{v} cm`; `Schematic section of {n} steps. Dimensions in cm.`; `Treads and risers assembled over a structure (structure not detailed).`; `Cantilevered treads fixed to the central post, developed along the walking line.`
Em en o formatador padrão deve usar ponto decimal; o componente passa `fmt` de `fmtNum`.

## Algoritmo (siga EXATAMENTE; R=riser, T=tread, n=steps, nos=type.nosing, d=type.structuralDepth)
Validação: se `!(R>0) || !(T>0)` ou não finitos → `throw new RangeError('riser e tread devem ser positivos')`.
Derivados: `H=hypot(T,R)`, `cosθ=T/H`, `Tv=d/cosθ`, `x0=Tv*T/R`, `θ=atan2(R,T)*180/PI`, `nh=min(0.03, 0.4*R)`, `tt=type.treadThickness`, `rt=type.riserThickness`, `ov=type.treadOverlap`.
`build(em)`:
1. Corpo (todos `role:'body'`, `tone:'body'`, `weight:'normal'`, `lineStyle:'solid'`, `fill:'body'`), mais uma `hatch` com o MESMO `pts` e `pattern:'concrete'` (monolítica) ou `'wood'` (montada, poste), id `hatch.<idDoCorpo>`:
   - monolithic/smooth: id `body.run`, pontos `(0,0) (0,R) (T,R) (T,2R) (2T,2R) … (nT,nR)` (para i=0..n−1: `(iT,(i+1)R)` e `((i+1)T,(i+1)R)`, a partir de `(0,0)`; depois do último, `(nT, max(nR−Tv,0))` e `(x0',0)` onde `x0'=x0` se `nR−Tv>0`, senão `(nT,0)` e o ponto `(x0',0)` é omitido).
   - monolithic/stepped (`type.undersideStyle==='stepped'`): mesmo topo; depois para i=n−1 até 0: `((i+1)T, max(iR−Tv,0))` e `(iT, max(iR−Tv,0))`; remova pontos consecutivos idênticos e o último se igual a `(0,0)`.
   - Nariz (monolithic e assembled, só se `nos>0`): para cada i: polígono `body.nosing.i` `[(iT−nos, (i+1)R−nh), (iT,(i+1)R−nh), (iT,(i+1)R), (iT−nos,(i+1)R)]` (sem hachura).
   - assembled: para cada i, `body.tread.i` = `[(iT−nos,(i+1)R−tt), ((i+1)T+rt,(i+1)R−tt), ((i+1)T+rt,(i+1)R), (iT−nos,(i+1)R)]` e `body.riser.i` = `[(iT,iR), (iT+rt,iR), (iT+rt,(i+1)R−tt), (iT,(i+1)R−tt)]`. (Nesse estilo NÃO crie `body.nosing.i`: o piso já avança `nos`.)
   - post: `body.tread.i` = `[(iT,(i+1)R−tt), ((i+1)T+ov,(i+1)R−tt), ((i+1)T+ov,(i+1)R), (iT,(i+1)R)]`; sem nariz e sem espelho.
2. Solo: `ground.line` (`line`, de `(−0.9T,0)` a `(0,0)`, `tone:'ground'`, `weight:'heavy'`, `role:'aux'`); hachura `hatch.ground` no retângulo `(−0.9T,−0.8em) (0,−0.8em) (0,0) (−0.9T,0)` com `pattern:'ground'`.
3. Guias (`role:'aux'`, `weight:'thin'`): `guide.pitch` polilinha `dashed` tom `accent` de `(0,R)` a `((n−1)T, nR)`. Se monolítica: `guide.under` `line` `dashed` tom `muted` de `(nT, nR−Tv)` a `p2`, onde `n̂=(R,−T)/H`, `p1=(nT,nR)`, `p2=p1+d·n̂`.
4. `obstacle = bboxOf(prims, p => p.kind!=='dimension' && p.kind!=='label')` (hachura do solo incluída). `lanes = new LaneStack(obstacle, em)`.
5. Textos e cotas, NESTA ORDEM (a ordem importa para as faixas):
   a. `dim.riser`: `axis:'y'`, `p1=(0,0)`, `p2=(0,R)`, `tone:'body'`; `line = lanes.take('left', CHAR_W*texto.length)`; `xL = line`.
   b. `lbl.nosing` (se `nos>0` e estilo ≠ post): `at=(xL, 1.45R)`, `anchor:'end'`, `leader=(−nos/2, R−nh/2)`, tom `muted`.
   c. `lbl.theta`: `at=(xL, 2.2R)`, `anchor:'end'`, `leader=(T/2, 1.5R)`, tom `accent`, texto com `θ` 1 casa.
   d. `lbl.floor`: `at=(xL, −1.2em)`, `anchor:'end'`, tom `muted`.
   Depois de b a d, chame `lanes.reserve('left', xL − CHAR_W*em*maiorTexto)` com o maior comprimento entre os rótulos.
   e. `dim.tread` (topo): `axis:'x'`, `p1=(T,2R)`, `p2=(2T,3R)`; `line = lanes.take('top', LINE_H)`. (Se n<3 use os dois últimos narizes.)
   f. Só post: `dim.overlap`: `axis:'x'`, `p1=(2T,3R)`, `p2=(2T+ov,3R)`, `line = lanes.take('top', 2*LINE_H)`, texto `overlap`. (Se `ov<=0`, não cria.)
   g. Monolítica: `dim.thick`: `axis:'aligned'`, `p1`, `p2` do passo 3, `line = 1.6*em`, tom `body`; depois `lanes.reserve('right', maiorX da dimTextBox)`.
   h. Direita, pé-direito e espessura de piso: `xH = lanes.take('right', CHAR_W*(maior linha do texto do pé-direito))`.
      - assembled/post: `dim.treadThick`: `axis:'y'`, `p1=(nT+extra, nR−tt)`, `p2=(nT+extra, nR)` onde `extra=rt` (assembled) ou `ov` (post); `line=xH`; texto `treadThick`.
      - `dim.headroom`: `axis:'y'`, `p1=((n−1)T, nR)`, `p2=((n−1)T, nR+3em)`, `line=xH`, `broken:true`, `tone:'danger'`, texto `headroom` com `minHeadroom` em m, 2 casas.
   i. Assembled: `dim.riserThick`: `axis:'x'`, `p1=(0,0)`, `p2=(rt,0)`, `line = lanes.take('bottom', LINE_H)`, texto `riserThick` (cm, 1 casa).
6. `frame = expandRect(união de bboxOf(todas as prims) com todas as caixas de texto (labelBox/dimTextBox) e as linhas de cota/extensões de dimGeometry, em)`.
7. Retorne `{ frame, em, prims, caption, meta:{kind:'stair-section'} }`. Ordem de `prims`: hachuras e corpo, solo, guias, cotas, rótulos.
Final: `return solveEm(build, 0.052 * obstacleWidthInicial)` onde `obstacleWidthInicial = (n*T + 0.9*T + 0.3)`. `caption`: monolítica `capMono` (com `{n}`=steps), assembled `capAssembled`, post `capPost`.

## Exemplo numérico de teste
`const type = { ...DEFAULT_STAIR_TYPES[0]!, runStyle:'monolithic', undersideStyle:'smooth', structuralDepth:0.12, nosing:0.015, minHeadroom:2.1 }` e `{ riser:0.18, tread:0.28 }`:
- `body.run` tem 9 pontos: `(0,0) (0,.18) (.28,.18) (.28,.36) (.56,.36) (.56,.54) (.84,.54) (.84,.39734) (.22192,0)` (toBeCloseTo 4 casas).
- `guide.pitch` vai de `(0,.18)` a `(.56,.54)`. `guide.under` de `(.84,.39734)` a `(.90489,.43906)`.
- `dim.riser.text === 'Espelho 18,0 cm'`, `dim.tread.text === 'Piso 28,0 cm'`, `lbl.theta.text === 'θ = 32,7°'`, `lbl.nosing.text === 'Nariz 1,5 cm'`, `dim.thick.text === 'Espessura estrutural
12,0 cm ⟂ à rampa'`; `dim.headroom.text === 'Pé-direito\nmín. 2,10 m'`, `broken===true`, e `p2.y − p1.y` ≈ `3*d.em` (4 casas).
- `checkDrawing(d)` retorna `[]`.
- Todas as cotas `dim.riser`, `dim.tread` têm a linha fora do bbox do corpo (já coberto por `dim-inside-bbox`).
Estilos:
- stepped (`undersideStyle:'stepped'`): `body.run` tem 13 pontos e contém `(.84,.21734)`, `(.56,.21734)`, `(.56,.03734)`, `(.28,.03734)`, `(.28,0)`; `checkDrawing` `[]`.
- assembled (`treadThickness .03, riserThickness .02, nosing .015`): existem 3 `body.tread.*` e 3 `body.riser.*`, nenhum `body.nosing.*`, nenhum `dim.thick`; `body.tread.0` = `(−.015,.15) (.30,.15) (.30,.18) (−.015,.18)`; `body.riser.0` = `(0,0) (.02,0) (.02,.15) (0,.15)`; existem `dim.treadThick` (texto `Piso (espessura)\n3,0 cm`) e `dim.riserThick` (`Espelho (espessura) 2,0 cm`); `checkDrawing` `[]`.
- post (`treadThickness .04, treadOverlap .02`): 3 `body.tread.*`; `body.tread.0` = `(0,.14) (.30,.14) (.30,.18) (0,.18)`; nenhum `body.riser.*`, nenhum `lbl.nosing`; existe `dim.overlap` com texto `Sobreposição\n2,0 cm`; `checkDrawing` `[]`.
- en: `lang:'en'` e `fmt = (n,d)=>n.toFixed(d)`: `dim.riser.text === 'Riser 18.0 cm'`.
- Inválido: `riser:0` e `tread:NaN` lançam `RangeError`.
- Escala: com `tread 0.28` e `tread 0.30`, `d.em / (d.frame.x1 − d.frame.x0)` ≥ 0.026 nos 4 estilos.
- Sem cor literal: `JSON.stringify(d)` não contém `#`.
- Ids únicos (já no checador).
Se `checkDrawing` apontar sobreposição de rótulos, ajuste SOMENTE os `y` dos rótulos da esquerda (b, c, d) afastando-os na vertical (múltiplos de `1.2*em`), nunca altere os outros números. Relate o ajuste.

## Componente `StairSectionPreview.tsx`
- Mantém props. Usa `useI18n((s)=>s.lang)`, `I18N[lang]`, `fmtNum` (como o arquivo atual).
- Se R ou T inválidos: `<p className="stt-preview-empty">{t.stt_preview_empty}</p>` (como hoje).
- Senão: `const d = buildStairSectionDrawing(type, {riser:r, tread:tp, lang, fmt:(n,dec)=>fmtNum(n,dec,lang)})` dentro de `useMemo` com try/catch (erro → mesma mensagem vazia). Renderiza `<SchematicViews tabsLabel={t.stt_preview_title} views={[{ id:'section', label:t.stt_preview_title, drawing:d, ariaLabel }]} />` com `ariaLabel` = `fill(t.stt_preview_aria, {riser, tread, style})` como hoje (reaproveite `fill` e `STYLE_KEY` do arquivo atual).
- Remova todo HTML `.stt-dim`, `vectorEffect` manual e os fallbacks de cor.
- Não importe `stairSectionAnchors`/`stairSectionProfile`.

## Comandos (nesta ordem, sem erro)
```
cd C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2
npx vitest run apps/web
npx tsc --noEmit
npx eslint apps/web/src
```
## Critérios de aceite
- Testes novos passam; os antigos (`stairSectionProfile.test.ts` etc.) continuam passando.
- `buildStairSectionDrawing` não importa React nem `@hestia/engine`.
- Para os 4 estilos `checkDrawing(d)` é `[]`.
- Nenhum `#hex`/`rgb` nos arquivos novos; `git status` só mostra os 3 arquivos permitidos.
## Commit
`git add apps/web/src/ui/dialogs/stairSectionDrawing.ts apps/web/src/ui/dialogs/stairSectionDrawing.test.ts apps/web/src/ui/dialogs/StairSectionPreview.tsx && git commit -m "feat(web): corte técnico da escada com cotas fora do desenho e pé-direito quebrado"` + linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. SEM push.

## RELATÓRIO FINAL (obrigatório, até 15 linhas)
Arquivos alterados/criados; última linha de `vitest`, `tsc`, `eslint`; ajustes que fez nos `y` dos rótulos (se houve); desvios do algoritmo e por quê; dúvidas.
