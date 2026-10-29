# Tarefa visual 3: `buildRampSectionDrawing` (corte e planta) + nova `RampSectionPreview` (depende da tarefa 1)

Modelo executor: DeepSeek flash. PRÉ-REQUISITO: tarefa 1 commitada (`apps/web/src/ui/schematic/{drawing,geometry,lanes}.ts` e `SchematicDrawing.tsx`). Confira com `git log --oneline -5`; se faltar, PARE e avise.
Referência: `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\especificacao-visual.md` seções 1, 2, 3, 5 e 6 (mocks ASCII lá).

## Contexto
Worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2`, app em `apps/web/src`. A prévia do tipo de rampa (`ui/dialogs/RampSectionPreview.tsx`, 24 linhas) é simples demais. Você cria o modelo de desenho puro `buildRampSectionDrawing` (duas vistas: corte e planta esquemática) e troca a prévia para `SchematicViews` com as abas `Corte | Planta`.
Do modelo (`@hestia/model`): `RampType` (campos em metros: `structuralDepth`, `landingThickness`, `defaultWidth`, `minWidth`, `defaultSlope` (fração), `landingMinLength`, `minHeadroom`, `normProfile`, `normChecked`, `normTable: {maxSlope,maxRise,maxFlights|null}[]` crescente), `rampNormRowFor(type, slope)` (1ª linha com `slope <= maxSlope`, ou `null`), `formatRampSlope(slope)` (ex.: `8,33 % (1:12)`), `DEFAULT_RAMP_TYPES` (índice 0 = NBR 9050: slope 1/12, tabela [5%→1,5 m; 6,25%→1,0 m; 8,33%→0,8 m/15 lances], `landingMinLength 1.2`, `structuralDepth .15`, `landingThickness .15`, `defaultWidth 1.5`, `normChecked false`; índice 1 = ADA: tabela [8,33%→0,762 m], `landingMinLength 1.525`, `defaultWidth 1.2`, `normChecked true`). Do desenho: tipos de `../schematic/drawing.ts` (+ `CHAR_W`, `LINE_H`), `bboxOf`, `expandRect`, `labelBox`, `dimTextBox`, `dimGeometry`, `checkDrawing` de `../schematic/geometry.ts`, `LaneStack`, `solveEm` de `../schematic/lanes.ts`.

## Arquivos que você PODE criar/editar
- criar `apps/web/src/ui/dialogs/rampSectionDrawing.ts` e `rampSectionDrawing.test.ts`
- reescrever `apps/web/src/ui/dialogs/RampSectionPreview.tsx` (mesmo nome e props `{ type: RampType }`)
## NÃO tocar
`RampTypeDialog.tsx`, `styles.css`, `editor/i18n.ts`, `packages/*`, `ui/schematic/*`, qualquer arquivo de escada.

## API obrigatória
```ts
export interface RampDrawingParams {
  view: 'section' | 'plan';
  slope?: number;        // fração; padrão type.defaultSlope; <=0 ou não finito => RangeError
  totalRise?: number;    // m; padrão: 1.5 × maxRise (ou 1.2 se não há tabela); limitado a 2 × maxRise
  lang?: 'pt' | 'en';
  fmt?: (n: number, decimals: number) => string;   // padrão pt-BR (toFixed + vírgula)
}
export function buildRampSectionDrawing(type: RampType, params: RampDrawingParams): Drawing;
export interface RampDrawingText { /* chaves abaixo */ }
export const RAMP_DRAWING_TEXT: Record<'pt' | 'en', RampDrawingText>;
```
Textos (`{v}`,`{m}` = números já formatados):
pt: run `c = {v} m`; total `L = {v} m`; landing `Patamar ≥ {v} m`; rise `h = {v} m`; riseMax `h = {v} m\nmáx. {m} m ✓`; riseMaxUnchecked `h = {v} m\nmáx. {m} m ✓ · a conferir`; thick `e = {v} cm ⟂\n(vertical {m} cm)`; headroom `Pé-direito livre\nmín. {v} m`; flight1 `Lance 1`; flight2 `Lance 2`; overLimit `Inclinação acima da norma\n(máx. {v})`; slope `i = h ÷ c = {v}`; width `Largura {v} m`; up `Sobe`; land `Patamar`; capSection `Escala vertical ×{k} (esquemático). Lance 1: h {h1} m, c {c1} m. Lance 2: h {h2} m, c {c2} m. Níveis: {levels}.` (com um só lance omita "Lance 2"); capPlan `Planta esquemática em U; o giro e o número de lances dependem da rampa criada.`
en: `c = {v} m`; `L = {v} m`; `Landing ≥ {v} m`; `h = {v} m`; `h = {v} m\nmax. {m} m ✓`; `h = {v} m\nmax. {m} m ✓ · to be checked`; `e = {v} cm ⟂\n(vertical {m} cm)`; `Headroom\nmin. {v} m`; `Flight 1`; `Flight 2`; `Slope above code\n(max. {v})`; `i = h ÷ c = {v}`; `Width {v} m`; `Up`; `Landing`; `Vertical scale ×{k} (schematic). Flight 1: h {h1} m, c {c1} m. Flight 2: h {h2} m, c {c2} m. Levels: {levels}.`; `Schematic U-shaped plan; the turn and the number of flights depend on the ramp created.`
A inclinação em texto vem de `formatRampSlope(slope)`; em `en` troque `,` por `.`.

## Cálculo comum
`s=slope`, `row=rampNormRowFor(type,s)`, `hasTable=type.normTable.length>0`, `overLimit = hasTable && row===null`, `maxRise = row?.maxRise ?? (hasTable ? última linha.maxRise : null)`.
`totalRise` = `params.totalRise ?? (maxRise ? 1.5*maxRise : 1.2)`, depois `min(totalRise, 2*maxRise)` se `maxRise`.
Lances: se `maxRise`: `r1=min(maxRise,totalRise)`, `r2=totalRise−r1`; senão `r1=r2=totalRise/2`. Se `r2<1e-9` há UM lance (`nFl=1`, sem patamar), senão `nFl=2`.
`c_k=r_k/s`, `P=type.landingMinLength`, `Ltot = c1 + (nFl==2 ? P + c2 : 0)`.
`tv=type.structuralDepth*sqrt(1+s*s)`, `lt=type.landingThickness`.
`vExag = clamp(Math.round(Ltot / (3.2*(totalRise+tv))), 1, 12)`; `Y(h)=h*vExag`; `tvY=tv*vExag`, `ltY=lt*vExag`, `m=max(tvY,ltY)`.

## Vista 'section' (`meta.kind:'ramp-section'`, `meta.vExag=vExag`)
Corpos `role:'body'`, `fill:'body'`, `tone:'body'`, `weight:'normal'`, `solid`, hachura `concrete` por cima (id `hatch.<corpo>`):
- `body.flight.0`: `(0,0) (c1,Y(r1)) (c1,Y(r1)−tvY) (0,−tvY)`.
- se `nFl==2`: `body.landing.0`: `(c1,Y(r1)) (c1+P,Y(r1)) (c1+P,Y(r1)−ltY) (c1,Y(r1)−ltY)`; `body.flight.1`: `(c1+P,Y(r1)) (Ltot,Y(totalRise)) (Ltot,Y(totalRise)−tvY) (c1+P,Y(r1)−tvY)`.
Solo (`role:'aux'`): `ground.low` linha `(−P,0)–(0,0)` tom `ground` peso `heavy`; hachura `hatch.ground.low` no retângulo `(−P,−0.8em) (0,−0.8em) (0,0) (−P,0)` padrão `ground`. `ground.high` linha de `(Ltot,Y(totalRise))` a `(Ltot+P,Y(totalRise))`, mesmo estilo.
Triângulo de inclinação (`role:'aux'`, tom `accent`, `thin`, `solid`), com `g=1.2*em`: `P0=(0, −m−g)`, `P1=(c1, P0.y)`, `P2=(c1, Y(r1)−m−g)`; polilinha `guide.triangle` com pontos `[P0,P1,P2,P0]`.
`obstacle = bboxOf(prims não-cota e não-rótulo)`; `lanes = new LaneStack(obstacle, em)`.
Cotas e rótulos, NESTA ORDEM:
1. `dim.run.0`: `axis:'x'`, `p1=P0`, `p2=P1`, `tone:'body'`, texto `run` (`c1` 2 casas); `yRow1 = lanes.take('bottom', LINE_H)`; `line=yRow1`.
2. se `nFl==2`: `dim.run.1`: `axis:'x'`, `p1=(c1+P, P0.y)`, `p2=(Ltot, P0.y)`, `line=yRow1`, texto `run` (c2).
3. se `nFl==2`: `dim.landing`: `axis:'x'`, `p1=(c1,P0.y)`, `p2=(c1+P,P0.y)`, `line=lanes.take('bottom', LINE_H)`, texto `landing` (P 2 casas).
4. `dim.total`: `axis:'x'`, `p1=(0,P0.y)`, `p2=(Ltot,P0.y)`, `line=lanes.take('bottom', LINE_H)`, texto `total` (só se `nFl==2`).
5. `dim.rise.0`: `axis:'y'`, `p1=P1`, `p2=P2`, `line=c1+1.6*em`; texto: se `maxRise` e `r1<=maxRise+1e-9`: `riseMax` (`riseMaxUnchecked` se `!type.normChecked`) com tom `ok`; senão `rise` com tom `danger` (se `overLimit`) ou `body`.
6. `lbl.slope`: dentro do triângulo, `at=(c1−0.5*em, P0.y+1.1*em)`, `anchor:'end'`, tom `accent`, texto `slope` com `formatRampSlope`. Se `checkDrawing` acusar `text-on-guide` ou `text-overlap` por causa dele (rampas muito inclinadas), troque por `at=(xRight, P0.y+1.1*em)` na faixa direita com `leader=(c1−0.3*em, P0.y+0.4*em)`.
7. `lbl.flight.0` texto `flight1`: `at=(c1/2, Y(r1)/2 + 0.975*em)`, `anchor:'end'`, tom `muted`. Se `nFl==2`: `lbl.flight.1` texto `flight2`: `at=((c1+P)+c2/2, (Y(r1)+Y(totalRise))/2 + 0.975*em)`, `anchor:'end'`, tom `muted`.
8. `dim.thick` (esquerda): `axis:'y'`, `p1=(0,0)`, `p2=(0,−tvY)`, `line = lanes.take('left', CHAR_W*(maior linha do texto))`, texto `thick` com `e = structuralDepth*100` (1 casa) e vertical `tv*100` (1 casa).
9. `dim.headroom` (direita): `xH = lanes.take('right', CHAR_W*(maior linha))`; `axis:'y'`, `p1=(Ltot, Y(totalRise))`, `p2=(Ltot, Y(totalRise)+3*em)`, `line=xH`, `broken:true`, tom `danger`, texto `headroom` (`minHeadroom` 2 casas).
10. se `overLimit`: `lbl.limit` na faixa de cima: `yT = lanes.take('top', 2*LINE_H)`; `at=(0, yT + 1.2*em)`, `anchor:'start'`, tom `danger`, texto `overLimit` com `maxSlope` da última linha formatado por `formatRampSlope`.
`frame = expandRect(bbox de tudo + caixas de texto + linhas de cota/extensões, em)`.
`caption`: `capSection` com `{k}=vExag`, `{h1}`, `{c1}`, `{h2}`, `{c2}` (2 casas), `{levels}` = `+0,00, +0,80, +1,20` (cotas acumuladas, 2 casas, sinal `+`).
Ordem de `prims`: hachuras e corpos, solo, triângulo, cotas, rótulos. Retorne `solveEm(build, 0.052 * (Ltot + 2*P))`.

## Vista 'plan' (`meta.kind:'ramp-plan'`, SEM exagero)
`w=type.defaultWidth`, `Pd=max(P,w)`. Polígonos `role:'body'`, `fill:'soft'`, `tone:'body'`, `weight:'normal'`:
- `body.flight.0`: `(0,0) (c1,0) (c1,w) (0,w)`.
- se `nFl==2`: `body.landing.0`: `(c1,0) (c1+Pd,0) (c1+Pd,2w) (c1,2w)` + hachura `diagonal`; `body.flight.1`: `(c1−c2,w) (c1,w) (c1,2w) (c1−c2,2w)`.
- Seta de subida `guide.arrow` (polilinha `arrowEnd:true`, `role:'aux'`, tom `accent`, `normal`): se `nFl==2`: `(0.4, w/2) (c1+Pd/2, w/2) (c1+Pd/2, 1.5w) (c1−c2+0.4, 1.5w)`; se um lance: `(0.4,w/2) (c1−0.4,w/2)`.
Cotas e rótulos: `lanes=new LaneStack(obstacle,em)`.
1. `dim.width` (esquerda): `axis:'y'`, `p1=(0,0)`, `p2=(0,w)`, texto `width` (2 casas), tom `danger` se `w < type.minWidth` senão `body`; `xL = lanes.take('left', CHAR_W*texto.length)`.
2. `lbl.up`: `at=(xL, 1.2*w + 1.2*em)`, `anchor:'end'`, tom `accent`, texto `up`, `leader=(0.4, w/2)`.
3. `dim.run.0` (baixo): `axis:'x'`, `p1=(0,0)`, `p2=(c1,0)`, texto `run` (c1), `line=lanes.take('bottom', LINE_H)`.
4. se `nFl==2`: `dim.landing` (baixo, 2ª linha): `p1=(c1,0)`, `p2=(c1+Pd,0)`, texto `landing` (P), `line=lanes.take('bottom', LINE_H)`; `dim.run.1` (topo): `axis:'x'`, `p1=(c1−c2,2w)`, `p2=(c1,2w)`, texto `run` (c2), `line=lanes.take('top', LINE_H)`; `lbl.land`: `xR=lanes.take('right', CHAR_W*texto.length)`, `at=(xR, w)`, `anchor:'start'`, texto `land`, tom `muted`, `leader=(c1+Pd−0.2*em, w)`.
`caption = capPlan`. Mesmo `frame` e `solveEm` (`em0 = 0.052*(c1+Pd+2)`).

## Exemplos numéricos de teste (tipo `DEFAULT_RAMP_TYPES[0]`, `slope: 1/12`, `totalRise: 1.2`, pt)
- `vExag===4`, `meta.vExag===4`, `caption` começa por `Escala vertical ×4`.
- `body.flight.0.pts` ≈ `(0,0) (9.6,3.2) (9.6,3.2−0.602075) (0,−0.602075)` (toBeCloseTo 4 casas; `tv=0.15*√(1+1/144)=0.150519`).
- `body.landing.0.pts` ≈ `(9.6,3.2) (10.8,3.2) (10.8,2.6) (9.6,2.6)`; `body.flight.1.pts` ≈ `(10.8,3.2) (15.6,4.8) (15.6,4.197925) (10.8,2.597925)`.
- textos: `dim.run.0` `c = 9,60 m`; `dim.run.1` `c = 4,80 m`; `dim.landing` `Patamar ≥ 1,20 m`; `dim.total` `L = 15,60 m`; `dim.rise.0` `h = 0,80 m\nmáx. 0,80 m ✓ · a conferir` (tom `ok`); `lbl.slope` `i = h ÷ c = 8,33 % (1:12)`; `dim.headroom` `Pé-direito livre\nmín. 2,10 m` com `broken`.
- `checkDrawing(d)` é `[]`.
- ADA (`DEFAULT_RAMP_TYPES[1]`, `slope 1/12`, sem `totalRise`): `r1=0.762` → `dim.rise.0.text === 'h = 0,76 m\nmáx. 0,76 m ✓'`; `r2=0.381`; `checkDrawing` `[]`.
- Um lance: `totalRise: 0.5` (tipo 0): não existem `body.landing.0`, `body.flight.1`, `dim.landing`, `dim.total`, `lbl.flight.1`; `checkDrawing` `[]`.
- Acima da norma: `slope: 0.1` (tipo 0): existe `lbl.limit` (tom `danger`, texto contém `Inclinação acima da norma`) e `dim.rise.0.tone==='danger'`; `checkDrawing` `[]`.
- Planta (`view:'plan'`, tipo 0, `totalRise 1.2`): `body.flight.0` = `(0,0) (9.6,0) (9.6,1.5) (0,1.5)`; `body.landing.0` = `(9.6,0) (11.1,0) (11.1,3) (9.6,3)`; `body.flight.1` = `(4.8,1.5) (9.6,1.5) (9.6,3) (4.8,3)`; `dim.width.text === 'Largura 1,50 m'` (tom `body`); `guide.arrow.arrowEnd===true`; `checkDrawing` `[]`. Tipo com `defaultWidth: 0.9` e `minWidth: 1.2` → `dim.width.tone==='danger'`.
- en: `lang:'en'`, `fmt=(n,d)=>n.toFixed(d)`: `dim.run.0.text === 'c = 9.60 m'` e `lbl.slope.text === 'i = h ÷ c = 8.33 % (1:12)'`.
- `slope: 0` → `RangeError`.
- `JSON.stringify(d)` sem `#`. Em todos os casos `d.em/(d.frame.x1−d.frame.x0) >= 0.026`.
Se `checkDrawing` acusar sobreposições nos rótulos, ajuste apenas as posições `y` dos rótulos 6 e 7 (múltiplos de `1.2*em`) e relate.

## Componente `RampSectionPreview.tsx`
Props `{ type: RampType }`. `useI18n((s)=>s.lang)`, `fmtNum` de `../../editor/i18n.ts`. Constrói as duas vistas com `useMemo` (try/catch; se falhar, mostra `<p className="stt-preview-empty">` com o texto `Preencha a inclinação para ver o desenho.` / `Fill in the slope to see the drawing.`). Renderiza `<SchematicViews tabsLabel="Prévia da rampa|Ramp preview" views=[{id:'section', label:'Corte|Section', drawing, ariaLabel}, {id:'plan', label:'Planta|Plan', drawing, ariaLabel}] />`. `ariaLabel` seção: `Corte da rampa: inclinação {slopeTxt}, desnível por lance até {maxRise} m, espessura {e} cm` (en equivalente); planta: `Planta esquemática da rampa em U, largura {w} m`. O texto de `slopeTxt` vem de `formatRampSlope`. Textos fixos do componente ficam em constantes no próprio arquivo. Sem cores literais.

## Comandos (nesta ordem, sem erro)
```
cd C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2
npx vitest run apps/web
npx tsc --noEmit
npx eslint apps/web/src
```
## Critérios de aceite
Testes novos passam e nenhum antigo quebra; `checkDrawing` é `[]` em todos os casos acima; `rampSectionDrawing.ts` não importa React; sem `#hex`/`rgb`; `git status` só com os 3 arquivos permitidos.
## Commit
`git add apps/web/src/ui/dialogs/rampSectionDrawing.ts apps/web/src/ui/dialogs/rampSectionDrawing.test.ts apps/web/src/ui/dialogs/RampSectionPreview.tsx && git commit -m "feat(web): corte e planta técnicos da rampa com limite de norma por lance"` + linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. SEM push.

## RELATÓRIO FINAL (obrigatório, até 15 linhas)
Arquivos; última linha de `vitest`, `tsc`, `eslint`; ajustes de posição feitos; desvios e dúvidas.
