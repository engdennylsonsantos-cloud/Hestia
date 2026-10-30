# Tarefa E-livre 2 (DeepSeek flash): sessão ao vivo e ferramenta da escada livre

Trabalhe SÓ no worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\e-tool` (branch `feat/e-stairfree-tool`), criado a partir do `integ2` com `feat/e-stairfree-model` E `feat/e-stairfree-motor` já mescladas (a tarefa 1 do motor precisa estar pronta: o engine exporta `planStairFree`, `optimizeStair`, `layoutStairSegment`, `liveStairRemaining`, `stairLiveParams`, `fitSegment`, `turnRecuo`, `compactRing`, `turnLandingRing`, `FREE_COLLINEAR_ANGLE`, `FREE_MAX_TURN_ANGLE`; o modelo tem `Stair.freePath?`, `Stair.manualLandings?` e `StairGenerator` com `'free'`). Se algo disso faltar, PARE e diga no relatório. Sem push, sem `npm install`. Preserve CRLF: edite pelas ferramentas de edição e confira `git diff` (só as linhas pretendidas; se um arquivo virar LF, restaure CRLF). Comentários em pt-BR, no estilo do código em volta. Em dúvida entre duas leituras, escolha a mais simples e diga no relatório.

Leia ANTES: o contrato `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\contrato-escada-livre.md` (seções 5, 3, 4 e 11) e o código que você vai espelhar: `packages/tools/src/rampLiveSession.ts` (a sessão da rampa livre, é o MODELO desta tarefa: copie a estrutura, troque desnível por espelhos), `rampTool.ts` (trechos `free`, `liveConfig`, `liveSession`, `handleLive`, `createFree`, `adjust`), `rampLiveSession.test.ts`, `rampLiveMessages.ts`, `stairRunTool.ts`, `stairRunPlan.ts`, `stairCommands.ts`, `stairSketchState.ts`.

## Contexto
O Hestia já tem a RAMPA LIVRE (trajeto de cliques, patamar de giro em cada curva, "faltam X m" ao vivo, tecla A "Ajustar"). Agora a ESCADA LIVRE: o usuário clica um trajeto; cada trecho reto vira um lance e cada curva um patamar de giro. A diferença: o piso da escada é fixo (Blondel do tipo) e o que se conta são ESPELHOS: N = ceil(H ÷ espelho máx), h = H ÷ N, piso T. O cálculo já está pronto no engine (tarefa 1). Esta tarefa liga isso à ferramenta `StairRunTool` quando a forma é `'free'`.

## Nomes exatos do engine que você vai usar
```ts
// @hestia/engine
type StairFixed = { risers: number; tread: number };
interface StairLiveParams { risers: number; riserHeight: number; tread: number; maxPerFlight: number; landingLength: number }
stairLiveParams(H: number, type: StairType, opts?: { fixed?: StairFixed; width?: number; norms?: StairNorms }): StairLiveParams | { error: string }
interface StairLayoutPiece { kind: 'flight' | 'landing'; at: number; length: number; risers: number }
interface StairSegmentLayout { pieces: StairLayoutPiece[]; risers: number; length: number; leftover1: boolean }
layoutStairSegment(span: number, p: Pick<StairLiveParams,'tread'|'maxPerFlight'|'landingLength'>, need?: number, balanceTail?: boolean): StairSegmentLayout
interface StairRemaining { status: 'falta'|'alcancado'|'passou'; placed: number; falta: number; faltaLength: number; excess: number; closeAt: number | null }
liveStairRemaining(i: { params: StairLiveParams; span: number; risersBefore: number }): StairRemaining
interface TurnRecuo { tMin: number; tPref: number }
turnRecuo(theta: number, width: number, depth: number): TurnRecuo
interface SegmentFit { kind: 'run'|'pass'|'short'; bIn: number; aOut: number; span: number }
fitSegment(len: number, tread: number, tin: TurnRecuo | null, tout: TurnRecuo | null): SegmentFit
turnLandingRing(v, dA, dB, width, tIn, tOut?): Vec2[]   // 6 pontos
compactRing(ring: Vec2[]): Vec2[]
FREE_COLLINEAR_ANGLE (3° em rad), FREE_MAX_TURN_ANGLE (150° em rad)
planStairFree(path: Vec2[], H: number, type: StairType, o: { width: number; landingDepth?: number; manualLandings?: number[]; fixed?: StairFixed; norms?: StairNorms }): StairFreePlan | { error: string }
// StairFreePlan: { parts: StairComponentSketch[]; risers; riserHeight; tread; runs; landings; path: Vec2[]; extended; slack; truncated; note? }
optimizeStair(i: { path: Vec2[]; H: number; type: StairType; width: number; landingDepth?: number; manualLandings?: number[] }): { fixed: StairFixed; riserHeight; path: Vec2[]; gap; violation; messages: string[]; plan: StairFreePlan; note: string } | { error: string }
```

## O que fazer (nesta ordem; um commit por passo)

### Passo 1: mensagens puras `packages/tools/src/stairLiveMessages.ts` (+ `stairLiveMessages.test.ts`)
Funções puras, vírgula decimal:
- `TEXTO_ALCANCADO = 'nível de topo alcançado'`.
- `textoFaltaEspelhos(falta: number, faltaLength: number): string` → `faltam 5 espelhos (≈ 1,4 m)`; com `falta === 1`: `falta 1 espelho (≈ 0,3 m)`. O comprimento tem 1 casa.
- `textoPassouEspelhos(excess: number): string` → `passou 2 espelhos: a escada termina antes do cursor`; `excess === 1`: `passou 1 espelho: a escada termina antes do cursor`.
- `rotuloEscadaLivre(risers: number, riserHeight: number, tread: number, estado: string): string` → `16 espelhos · 17,5 cm · piso 28,0 cm · <estado>` (cm com 1 casa: 0,175 → "17,5"; 0,28 → "28,0").
- `estadoDoRestante(r: StairRemaining): string`: 'falta' → `textoFaltaEspelhos`; 'alcancado' → `TEXTO_ALCANCADO`; 'passou' → `textoPassouEspelhos`.
Teste: `rotuloEscadaLivre(16, 0.175, 0.28, textoFaltaEspelhos(5, 1.4))` === `16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)`; os casos singular/alcançado/passou.

### Passo 2: sessão `packages/tools/src/stairLiveSession.ts` (+ `stairLiveSession.test.ts`)
Copie a estrutura de `rampLiveSession.ts` (classe, estados `IDLE | ORIGIN | DRAWING | REACHED`, `click`, `move`, `back`, `finish`, `load`, `cancel`, `typeLength`, `configure`, `points`, `preview`, `hint`, `faltaConfirmada`) e troque o cálculo. API exata (contrato 5.1):
```ts
export type StairLiveState = 'IDLE' | 'ORIGIN' | 'DRAWING' | 'REACHED';
export interface StairLiveConfig { H: number; type: StairType; width: number; landingDepth?: number; fixed?: StairFixed; norms?: StairNorms }
export type StairLiveEvent =
  | { kind: 'added'; state: StairLiveState; message?: string }
  | { kind: 'ignored'; message: string }
  | { kind: 'warn'; message: string }
  | { kind: 'done'; path: Vec2[]; falta: number };
export const STAIR_LIVE_MAX_VERTICES = 40;
export class StairLiveSession { /* mesmos membros da RampLiveSession */ }
```
Diferenças em relação à rampa:
1. No `configure`/construtor calcule `params = stairLiveParams(H, type, { fixed, width, norms })`; se vier `{ error }`, guarde-o: `click`/`move` devolvem `ignored`/prévia só com um `label` do erro (a ferramenta já avisa antes). `D = max(landingDepth ?? width, width)`. `same` em `configure` compara `H, type, width, landingDepth, fixed?.risers, fixed?.tread`.
2. Estado por trecho (`Seg`): `a, b, dir, len, turnIn: TurnRecuo | null` (curva no início), `bIn` (recuo de saída do patamar do início do trecho, 0 no 1º), `risersBefore` (espelhos colocados antes do trecho), `lay: StairSegmentLayout`, `fit: SegmentFit`, `risersAfter`, `ring: Vec2[] | null` (anel `compactRing(turnLandingRing(v, prev.dir, dir, w, tIn, bIn))` do patamar no início do trecho), `items: PreviewItem[]`.
3. `evaluate(c)` (por `move`; tudo O(nº de lances), SEM `resolveStairs`, SEM `intersection`/booleanas, SEM `planStairFree` — o `planStairFree` só roda ao CONCLUIR, na ferramenta):
   - `v` = último ponto, `L = |c − v|`, `dir`. Sem trecho anterior: `bIn = 0`, `risersBefore = 0`, `turnIn = null`.
   - Com trecho anterior `prev`: `θ = acos(clamp(dot(prev.dir, dir)))`.
     - `θ > FREE_MAX_TURN_ANGLE`: `{ ok: false, message: 'Retorno agudo demais: use dois giros menores.' }`.
     - `θ < FREE_COLLINEAR_ANGLE`: vértice DISSOLVIDO. Remova o último ponto e o último trecho (`pts.pop(); segs.pop()`) e avalie `c` outra vez a partir do ponto anterior (laço; o 1º trecho dissolvido volta ao estado ORIGIN-com-1-ponto). Na confirmação (`click`) faça o mesmo antes de `append`. Nesses casos o clique substitui o último vértice.
     - Senão: `tin = turnRecuo(θ, w, D)`; `prevFit = fitSegment(prev.len, T, prev.turnIn, tin)`; se `prevFit.kind === 'short'` → `{ ok: false, message: 'O trecho anterior é curto demais para o patamar de giro.' }`; `prevLay` = `layoutStairSegment(prevFit.span, params, need, true)` com `need = N − prev.risersBefore` quando `prevFit.kind === 'run'`, ou layout vazio (trecho de passagem). `bIn = tin.tPref`; `risersBefore = prev.risersBefore + prevLay.risers`. O trecho anterior sem lance que seja o PRIMEIRO trecho (`prev.risersBefore === 0` e `prevLay.risers === 0` e sem trecho antes dele) → `{ ok: false, message: 'O 1º trecho é curto demais para um lance (mínimo 2 espelhos).' }`.
   - Vão vivo: `span = L − bIn`. Se `span < 0.01` → `short` (a prévia mostra só um tracejado `tone: 'path'` do último ponto ao cursor; `click` recusa com 'Afaste o cursor: o trecho é curto demais depois do patamar de giro.').
   - `r = liveStairRemaining({ params, span, risersBefore })`. `lay = layoutStairSegment(span, params, N − risersBefore, false)` (último vão: sem rebalanceio). Se `r.status === 'passou'`: `truncated = true`, o fim do trecho é `v + dir·(bIn + lay.length)` (o último espelho) e o estado vira REACHED ao confirmar.
   - Rótulo: `rotuloEscadaLivre(N, h, T, estadoDoRestante(r))`.
4. Prévia (por aritmética; nada de `generateStraightRun` por movimento): para cada peça do layout, lance → `polygon` `tone: 'tread'` com o retângulo do 1º ao último espelho (largura `w`) e uma `line` `tone: 'riser'` por espelho (de `−w/2` a `+w/2`, nos `u = bIn + piece.at + i·T`); patamar em linha → `polygon` `tone: 'landing'`; patamar de giro → `polygon` `tone: 'landing'` com o `ring`; trecho de passagem → `polygon` `tone: 'landing'` retângulo de `bIn` a `len − aOut`; eixo → `line` `tone: 'path'`. Mantenha o cache `frozen` (itens dos trechos 0..n−2) e refaça só o trecho anterior (por causa do giro) e o vivo, como a rampa.
5. `finish()`: com `faltaConfirmada > 0` na 1ª vez devolve `warn`: `Faltam ${n} espelhos: Enter de novo estende o último trecho em ${m} m e cria; A ajusta.` (`m = n·T`, 2 casas, vírgula; singular 'Falta 1 espelho: ...'); na 2ª devolve `done` com `falta`. `hint()` com os 4 textos do contrato 5.4. Recusas: 'Afaste o cursor do último ponto.', `Máximo de ${STAIR_LIVE_MAX_VERTICES} pontos. Enter conclui.`, 'Clique ao menos um segundo ponto para criar a escada.'.
6. `faltaConfirmada` = `max(0, N − último.risersAfter)`; REACHED quando `risersAfter ≥ N`.
Testes (numéricos; `DEFAULT_STAIR_TYPES` `stt_monolitica`, `H = 2.8`, `width = 1.2`; N 16, h 0,175, T 0,28): transições IDLE→ORIGIN→DRAWING; clique a 0,005 m do ponto inicial ignorado; reta `(0,0)→(5,0)`: o rótulo com o cursor em (3,0) é `16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)`; cursor em (4,2) → `... nível de topo alcançado`; cursor em (5,0) → `... passou 2 espelhos: a escada termina antes do cursor`; clique em (5,0) vira REACHED com `message` 'Nível de topo alcançado: ...' e o último ponto do rascunho em (4,2; 0); L: `(0,0)→(3,0)`, cursor em (3,1): rótulo com `faltam 5 espelhos` quando `width = 1.0` (vão vivo 0,5 → 2 espelhos, 9 antes → faltam 5); retorno agudo (cursor a 170° do trecho) → `ignored` com 'Retorno agudo demais: use dois giros menores.'; vértice colinear (clique a 2° do trecho) substitui o último ponto (`points.length` não cresce); Backspace REACHED→DRAWING→ORIGIN→IDLE; Esc (`cancel`) limpa; `finish` com falta: 1º `warn`, 2º `done` com `falta > 0`; clique repetido (< 0,05 m) conclui; 40 vértices; `load` restaura o rascunho e devolve false (mantendo o anterior) quando um ponto é recusado; `configure` com `fixed: { risers: 17, tread: 0.3125 }` muda o rótulo para 17 espelhos.
Desempenho: 2000 chamadas de `move` com 40 vértices confirmados (zigue-zague com ângulos de 40° a 120° e trechos de 1,5 m, `H = 8` para não fechar): média ≤ 2 ms (`performance.now`; se oscilar sob carga rode isolado e diga). Espie as funções do engine que não podem ser chamadas no `move`: um `vi.mock('@hestia/engine', async (orig) => ({ ...(await orig()), planStairFree: vi.fn(), resolveStairs: vi.fn() }))` e confira `not.toHaveBeenCalled()`.

### Passo 3: plano da ferramenta `packages/tools/src/stairRunPlan.ts` (+ testes onde já existirem para a lista de formas)
- `STAIR_RUN_SHAPES` ganha `'free'` no fim; `STAIR_RUN_SHAPE_LABEL.free = 'Livre'`; `MIN_RISERS.free = 2`.
- `planStairRun` com `shape === 'free'`: `return { error: 'A escada livre é planejada por planStairRunFree.' }` (logo após o caso `spiral`).
- Em `StairRunPlan` acrescente os campos opcionais `path?: Vec2[]; runs?: number; landings?: number; extended?: number; slack?: number`.
- Nova função exportada:
```ts
export interface StairFreePlanInput { path: Vec2[]; H: number; type: StairType; options: StairRunToolOptions; fixed?: StairFixed }
export function planStairRunFree(i: StairFreePlanInput): StairRunPlanResult
```
  Chama `planStairFree(i.path, i.H, i.type, { width: i.options.width, landingDepth: i.options.landingDepth, fixed: i.fixed })`; erro → o mesmo `{ error }`; sucesso → `{ parts: fromSketches(plan.parts, 'free'), risers, riserHeight, tread, note, path, runs, landings, extended, slack }`.
- Confira que `stairRunTypes.ts` (`stairTypesForShape`) trata `'free'` como as formas retas (tipos não caracol): `isSpiral = shape === 'spiral'` já faz isso; só ajuste se algum `Record<StairRunShape, …>` não compilar (`npx tsc --noEmit`).
- Teste: `planStairRunFree` com o Exemplo 2 do contrato (`[(0,0),(3,0),(3,2)]`, largura 1,0, H 2,80, `stt_monolitica`): 3 partes (run, landing, run), `risers` 16, `path[2]` ≈ (3, 2,18), `generatedBy: 'free'` nos lances; erro do motor sobe como `{ error }`; `planStairRun` com `shape: 'free'` devolve o erro acima.

### Passo 4: integração no `StairRunTool` (`packages/tools/src/stairRunTool.ts`) e criação (`stairCommands.ts`)
1. `stairCommands.ts`: SÓ `StairCreateOptions` (acrescente `freePath?: Vec2[]; manualLandings?: number[]`) e `createStairFromComponents` (repasse os dois ao `makeStair`, apenas quando `freePath` existe / `manualLandings` não é vazio). NÃO mexa em `updateStairComponents` (é da tarefa 3).
2. `StairRunTool` (espelhe `RampTool`): campos `private session: StairLiveSession | null = null; private fixed: StairFixed | undefined`; getter `free` (`this.opts.shape === 'free'`). Quando `free`:
   - `start()`: `reset()` e `env.say('Escada livre: clique o ponto inicial (centro do 1º espelho). Esc cancela.')`.
   - `reset()`: também `this.session?.cancel()` e `this.fixed = undefined`. `busy()`: também `(this.session?.state ?? 'IDLE') !== 'IDLE'`.
   - `inputPrompt()`: 'Comprimento (m)' em ORIGIN/DRAWING.
   - `move(p)`/`click(p)`: `snap(p, { from: último ponto da sessão })`, `liveSession()` (cria/configura a sessão com `liveConfig()`, que reaproveita `limitsNow()`/`creation()` e o tipo: `{ H, type, width: opts.width, landingDepth: opts.landingDepth, fixed: this.fixed }`; erro → `env.say(erro)`), e a mesma lógica de `liveMove`/`liveClick`/`handleLive` da `RampTool` (copie e adapte nomes).
   - `type(text)`: comprimento (`parseNumber`; 'Valor inválido. Digite o comprimento em metros.').
   - `confirm()`: Enter conclui (`session.finish()` → `handleLive`). `cancel()`: com rascunho, 1º Esc descarta e diz a dica inicial; 2º sai. `deleteKey()`: Backspace `session.back()`.
   - `createFree(path)`: `lim = limitsNow()`; `planStairRunFree({ path, H, type, options, fixed })`; erro → `session.load(path)`, `this.items = session.move(último ponto, 0)` e `env.say('Não é possível criar a escada: <erro> Backspace volta um ponto.')` (rascunho recuperado). Sucesso → `env.transaction('Criar escada', () => stairFromGenerator(env, comps, { ...creation(), generatedBy: 'free', freePath: plan.path, ... }))` com `comps = componentsFromParts(plan.parts)` (UMA transação, um passo de desfazer). Mensagem: `Escada criada: ${risers} espelhos de ${cm(h)} cm, piso ${cm(tread)} cm, ${runs} ${runs === 1 ? 'lance' : 'lances'}, ${landings} ${landings === 1 ? 'patamar' : 'patamares'}.` + ` ${note}` se houver + o 1º aviso de norma (mesma busca de `create`) + ` Ctrl+Z desfaz.`; depois `reset()` e `items = []`.
   - `adjust(): boolean` (tecla A; o controller já chama `tool.adjust?.()`): sem sessão ou `points.length < 2` → `false`. `optimizeStair({ path: pts, H, type, width, landingDepth })`; `{ error }` → `env.say(erro)` e `true`; sucesso → `this.fixed = r.fixed`, `liveSession()` reconfigurada, `session.load(r.path)`; se o `load` recusa, restaure `this.fixed` anterior e o trajeto antigo, diga 'Não foi possível ajustar: o trajeto ajustado fica curto demais ou faz retorno agudo.'; senão `this.items = session.move(último ponto, 0)` e `env.say(r.note)`. Retorna `true`.
   - Formas não-livres: NADA muda (reta/L/U/leque/caracol seguem o código atual; a suíte `stairRunTool.test.ts`, `stairRunLength.test.ts`, `stairSpiralTool.test.ts` passa sem mudar expectativa).
3. `packages/tools/src/index.ts`: exporte `StairLiveSession`, `STAIR_LIVE_MAX_VERTICES`, tipos `StairLiveState`/`StairLiveConfig`/`StairLiveEvent`, `planStairRunFree`, e as funções de `stairLiveMessages.ts` (só acrescente linhas).
4. Teste `stairRunToolFree.test.ts` (padrão dos testes `stairRunTool.test.ts`/`rampTool.test.ts`, mesmo ambiente falso): com `options.stairRun = { shape: 'free', width: 1.0, turn: 'left' }`, nível com topo em 2,80 m: cliques `(0,0)`, `(3,0)`, `(3,2)`, Enter → UMA escada (Exemplo 2: lance 9, patamar, lance 7, 16 espelhos); `freePath` gravado = `[(0,0),(3,0),(3,2.18)]` (±1e-6); `generatedBy 'free'` nos lances; `store.undo()` remove a escada inteira (um passo); plano recusado (trajeto `(0,0)`, `(4,0)`, `(4,3)`, `(1,3)`, `(1,-1)`: o último trecho cruza o 1º lance, a sessão aceita os cliques e o `planStairFree` recusa com uma mensagem que começa em 'O trajeto se sobrepõe ao trecho') mantém o rascunho: `session.points` volta com os mesmos pontos e a mensagem contém 'Backspace volta um ponto'; tecla A (`adjust()`) no Exemplo 1 (`(0,0)→(5,0)`, w 1,2) deixa 17 espelhos e a mensagem 'Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.'; `shape: 'straight'` continua criando como antes.

### Passo 5: barra de opções `apps/web/src/ui/StairRunOptionsBar.tsx`
- A lista de formas já vem de `STAIR_RUN_SHAPES` (a opção Livre aparece sozinha); acrescente `free` ao mapa `HINT`: `'Escada livre: clique os pontos do trajeto; Enter conclui, A ajusta, Backspace volta.'`.
- `turnable` passa a excluir `free` (`o.shape !== 'straight' && o.shape !== 'free' && !spiral`).
- Campo "Prof. patamar" (`NumField id="opt-stairlanding"`, unidade m, mínimo 0,1, vazio = largura, `onCommit` grava `landingDepth`, `onClear` apaga) visível para `lshape`, `ushape` e `free`. Se já existir no código, apenas inclua `free`.
- Não mexa em `i18n.ts` (é da tarefa 3).

## Arquivos
PODE criar: `packages/tools/src/{stairLiveMessages,stairLiveSession}.ts`, `stairLiveMessages.test.ts`, `stairLiveSession.test.ts`, `stairRunToolFree.test.ts`.
PODE alterar: `packages/tools/src/stairRunPlan.ts`, `stairRunTool.ts`, `stairCommands.ts` (só `StairCreateOptions` e `createStairFromComponents`), `stairRunTypes.ts` (só se o tsc exigir), `packages/tools/src/index.ts` (só acrescentar), `apps/web/src/ui/StairRunOptionsBar.tsx`, e os testes existentes só para acrescentar `'free'` a listas de formas (nunca mudar expectativa de outro comportamento).
NÃO PODE tocar: `packages/model`, `packages/engine`, `packages/render`, `packages/io`, `rampLiveSession.ts`, `rampTool.ts`, `stairGrips.ts`, `selectGrips.ts`, `selectTool.ts`, `updateStairComponents`, `apps/web/src/editor/i18n.ts`, `StairProperties.tsx`, `apps/web/src/editor/*Actions.ts`.

## Verificar (dentro do worktree)
`npx vitest run packages apps/web` (tudo verde; teste de tempo que estourar sob carga: rode isolado e diga), `npx tsc --noEmit`, `npx eslint packages apps/web/src` (0 erros).

## Critérios de aceite
1. As 3 transições do contrato (ORIGIN, DRAWING, REACHED), os textos exatos e os números dos exemplos passam.
2. `move` da sessão: média ≤ 2 ms em 40 vértices; nenhuma chamada a `planStairFree`/`resolveStairs`/booleanas no `move`.
3. Criação em UMA transação com `freePath` gravado; plano recusado mantém o rascunho; A ajusta.
4. As outras formas de escada e a rampa livre não mudam (suítes existentes verdes).
5. Commits em pt-BR, um por passo ("Adiciona mensagens da escada livre", "Adiciona sessão ao vivo da escada livre", "Adiciona plano da escada livre na ferramenta", "Liga a escada livre ao StairRunTool", "Mostra a forma Livre na barra de escada"), sem push.

Termine com um RELATÓRIO FINAL curto: arquivos, API exportada, contagem de testes, resultado do teste de desempenho (média em ms), decisões onde houve margem, desvios e pendências.
