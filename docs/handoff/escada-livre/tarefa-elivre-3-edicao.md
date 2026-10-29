# Tarefa E-livre 3 (DeepSeek flash): editar a escada livre (regeneração, grips, botão Ajustar, i18n)

Trabalhe SÓ no worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\e-edit` (branch `feat/e-stairfree-edit`), criado a partir do `integ2` com `feat/e-stairfree-model` E `feat/e-stairfree-motor` já mescladas (o engine exporta `planStairFree`, `optimizeStair`, `StairFixed`, `FREE_COLLINEAR_ANGLE`; o modelo tem `Stair.freePath?`, `Stair.manualLandings?`, `StairGenerator` com `'free'`). Esta tarefa roda em PARALELO com a tarefa 2 (ferramenta): não toque nos arquivos dela. Se algo do engine/modelo faltar, PARE e diga no relatório. Sem push, sem `npm install`. Preserve CRLF: edite pelas ferramentas de edição e confira `git diff` (só as linhas pretendidas; se um arquivo virar LF, restaure CRLF). Comentários em pt-BR, no estilo do código em volta. Em dúvida entre duas leituras, escolha a mais simples e diga no relatório.

Leia ANTES: o contrato `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\contrato-escada-livre.md` (seções 0.1, 6, 7, 8, 11) e o código que você vai ESPELHAR (copie a estrutura e troque rampa por escada): `packages/engine/src/rampEdit.ts` (`regenRamp`, ramo `regenFree`), `packages/tools/src/rampGrips.ts` (+ `rampGrips.test.ts`), `apps/web/src/editor/rampActions.ts` (+ `rampActions.test.ts`: `applyRegen`, `adjustRamp`), `apps/web/src/ui/RampProperties.tsx` (botão Ajustar, `adjustMsg`), `packages/tools/src/selectGrips.ts` (providers), `packages/tools/src/stairGrips.ts`, `packages/tools/src/stairRunEdit.ts`, `apps/web/src/ui/StairProperties.tsx`, `apps/web/src/editor/stairActions.ts` (`patchStairs`), `apps/web/src/editor/i18n.ts` (`ramp_adjust`, `ramp_adjust_title`).

## Contexto
O Hestia já tem a RAMPA LIVRE: o trajeto fica guardado em `Ramp.freePath` e, ao mexer num vértice (grip) ou nas propriedades, a rampa é regenerada a partir dele; o botão "Ajustar" otimiza à norma. Agora o mesmo para a ESCADA LIVRE: `Stair.freePath?: Vec2[]` (vértices do trajeto) e `Stair.manualLandings?: number[]` já existem no modelo (outro agente). O motor puro (`planStairFree`, `optimizeStair`) já está pronto (tarefa 1). A ferramenta que CRIA a escada livre é a tarefa 2 (outra pessoa). Aqui: editar uma escada livre existente.

Decisões do contrato que você deve seguir (0.1): D6 = a edição preserva o par (N, T) medido da escada atual enquanto `H/N ≤ espelho máx do tipo`; senão volta aos padrões. A profundidade do patamar de giro após edição = largura do lance. A tecla A da ferramenta NÃO é desta tarefa (fica na tarefa 2).

## O que fazer (nesta ordem; um commit por passo)

### Passo 1: regeneração no engine `packages/engine/src/stairFreeEdit.ts` (+ `stairFreeEdit.test.ts`)
```ts
import type { Project, Stair, StairLanding, StairRun } from '@hestia/model';
export interface StairFreePatch {
  freePath?: Vec2[];            // novo trajeto (mover vértice)
  width?: number;               // nova largura do lance
  landingDepth?: number;        // padrão = largura
  manualLandings?: number[];
  fixed?: StairFixed | 'auto';  // 'auto' = ignora o par medido e usa os padrões do tipo
}
export interface StairFreeResult {
  components: Array<StairRun | StairLanding>;
  freePath: Vec2[];             // trajeto normalizado pelo plano
  manualLandings?: number[];
  plan: StairFreePlan;
}
export function measureFreeStair(stair: Stair): { width: number; fixed: StairFixed } | null;
export function regenStairFree(stair: Stair, p: Project, patch: StairFreePatch): StairFreeResult | { error: string };
```
- `measureFreeStair`: usa o 1º componente `run`; `width = dist(risers[0].a, risers[0].b)`; `N = ` soma de `risers.length` de todos os lances (lances separados por patamar não compartilham espelho); `tread = dist(centro do espelho 0, centro do espelho 1)` do 1º lance (se o lance tem ≥ 2 espelhos). Sem lance ou sem espelhos suficientes → `null`.
- `regenStairFree`: `stair.freePath` com ≥ 2 pontos, senão `{ error: 'A escada não tem trajeto livre para regenerar.' }`; tipo inexistente → `{ error: 'Tipo de escada inexistente' }`; `H = stairTopZ(p, stair) − stairBaseZ(p, stair)` (de `@hestia/model`); `H` ≤ 0 → `{ error: 'O nível de topo não fica acima da base: nada a gerar.' }`; `m = measureFreeStair(stair)`; `width = patch.width ?? m?.width` (ausente → `{ error: 'A escada não tem um lance válido para regenerar.' }`); `fixed`: `patch.fixed === 'auto'` → `undefined`; objeto → ele; ausente → `m.fixed` se `H / m.fixed.risers ≤ type.maxRiser + 1e-9` e `m.fixed.risers ≥ 2`, senão `undefined`; chama `planStairFree(patch.freePath ?? stair.freePath, H, type, { width, landingDepth: patch.landingDepth ?? width, manualLandings: patch.manualLandings ?? stair.manualLandings, fixed })`. Componentes: cada parte vira `{ id, kind: 'run', generatedBy: 'free', ...run }` ou `{ id, kind: 'landing', ...landing }`, reaproveitando `stair.components[i]?.id` da mesma posição quando o tipo do componente coincide, senão `newId('r')`/`newId('p')`.
- Exporte em `packages/engine/src/index.ts` (só acrescentar `export * from './stairFreeEdit.ts';`).
Testes (tipo `stt_monolitica`, nível de 2,80 m; monte a escada como o teste de `planStairFree`/`stairs.test.ts`: `makeStair` com os componentes do plano e `freePath` = `plan.path`): Exemplo 2 do contrato (`[(0,0),(3,0),(3,2)]`, largura 1,0): mover o vértice do meio para `(3.2,0.4)` e confira que a soma dos espelhos continua 16 e que `freePath` volta normalizado; ids dos componentes preservados; `measureFreeStair` devolve `{ width: 1, fixed: { risers: 16, tread: 0.28 } }` (±1e-9); escada com T ajustado (`fixed: { risers: 17, tread: 0.3125 }` na criação) mantém 17/0,3125 após `regenStairFree(stair, p, { freePath })`; mudar o topo para 4,20 m (H/16 = 0,2625 > 0,18) recalcula N pelos padrões (N = 24); `fixed: 'auto'` ignora o medido; escada sem `freePath` → erro; tipo inexistente → erro; trajeto que o motor recusa (vértice sobre o anterior fazendo retorno agudo) → `{ error }` com a mensagem do motor.

### Passo 2: grips `packages/tools/src/stairFreeGrips.ts` (+ `stairFreeGrips.test.ts`)
Copie `rampGrips.ts` trocando rampa por escada:
```ts
export interface StairFreeGrip { stairId: Id; index: number; at: Vec2 }
export function stairFreeGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): StairFreeGrip | null   // vértices de Stair com freePath; tolerância 9 * mpp
export function stairFreeHold(env: ToolEnv, g: StairFreeGrip): GripHold
export function stairFreeHandlePreview(p: Project, ids: Id[]): PreviewItem[]
```
- `stairFreeHold.drag`: ponto = `snap({ extraPoints: demais vértices })`; `regenStairFree(stair, project, { freePath: novoTrajeto })`; prévia = `componentsPreview(stair.components, true)` (tracejado) + `componentsPreview(res.components)` quando não há erro (importe `componentsPreview` de `./stairPreview.ts`).
- `release`: sem mudança (distância < 1e-9) não grava; erro do motor → `env.say('Não é possível mover o vértice: <erro>')` sem gravar; sucesso → UMA transação `env.transaction('Mover vértice da escada', () => env.exec({ type: 'updateElements', ids: [g.stairId], patch: { components: res.components, freePath: res.freePath, manualLandings: res.manualLandings } }))` e `env.say('Vértice movido. Ctrl+Z desfaz.')`.
- `packages/tools/src/selectGrips.ts`: crie o provider `stairFreeGrip` (como `rampGrip`) e coloque-o ANTES de `stairGrip` na lista `gripProviders`. `packages/tools/src/stairGrips.ts`: `stairGripAt` passa a IGNORAR escadas com `freePath` (`if (s.freePath) continue;`), senão arrastar a ponta de uma linha do croqui dessincroniza o trajeto; `stairHandlePreview` idem. `packages/tools/src/selectTool.ts`: no hover chame também `stairFreeHandlePreview` (como `rampHandlePreview`). `packages/tools/src/index.ts`: exporte `stairFreeGripAt`, `stairFreeHold`, `stairFreeHandlePreview` e o tipo `StairFreeGrip` (só acrescentar linhas).
- `packages/tools/src/stairCommands.ts`: altere SÓ `updateStairComponents`: o patch passa a ser `{ components, freePath: undefined, manualLandings: undefined }` (editar o croqui à mão descarta o trajeto livre; confirme que `updateElements` com `undefined` remove/zera o campo — veja o comando; se ele mantiver a chave com `undefined`, o teste deve olhar `s.freePath === undefined`). NÃO mexa em `createStairFromComponents` nem em `StairCreateOptions` (são da tarefa 2).
Testes: `stairFreeGripAt` acha o vértice dentro da tolerância e devolve null fora dela ou em escada sem `freePath`; arrastar o vértice do meio e soltar grava `components` e `freePath` novos numa só transação (`store.undo()` volta ao estado anterior em UM passo); soltar com trajeto recusado não grava e diz a mensagem; `stairGripAt` ignora escada com `freePath` (e continua achando grips em escada sem); `updateStairComponents` em escada livre apaga `freePath`.

### Passo 3: ações da interface `apps/web/src/editor/stairFreeActions.ts` (+ `stairFreeActions.test.ts`)
```ts
export function applyStairFreeRegen(store: ProjectStore, id: Id, r: StairFreeResult, label = 'Editar escada'): void   // UM updateElements dentro de store.transaction
export function adjustStairFree(store: ProjectStore, id: Id): { message: string } | { error: string }
export function patchStairFree(store: ProjectStore, id: Id, patch: Partial<Stair>, label?: string): { error: string } | null
```
- `adjustStairFree` (espelha `adjustRamp`): escada inexistente ou sem `freePath` → `{ error: 'Escada livre inexistente.' }`; tipo inexistente → `{ error: 'Tipo de escada inexistente' }`; `H ≤ 0` → `{ error: 'O nível de topo não fica acima da base: nada a ajustar.' }`; `m = measureFreeStair(stair)`; `optimizeStair({ path: stair.freePath, H, type, width: m.width, landingDepth: m.width })`; `{ error }` sobe; sucesso → `regenStairFree(stair, p, { freePath: r.path, fixed: r.fixed })` e `applyStairFreeRegen(store, id, res, 'Ajustar escada')` (UMA transação); devolve `{ message: r.note }`.
- `patchStairFree`: grava `patch` (níveis, deslocamentos, altura, tipo) E regenera na MESMA transação: monta a escada atualizada `{ ...stair, ...patch }` e o projeto com ela (`store.project` com o elemento substituído, sem gravar), roda `regenStairFree(atualizada, projetoAtualizado, {})`; se erro → NÃO grava nada e devolve `{ error }`; senão uma transação com `updateElements` `{ ...patch, components, freePath, manualLandings }`. Para criar o projeto de simulação use o mesmo recurso que `rampActions.ts`/`stairActions.ts` usam para simular (se não houver, monte `{ ...p, elements: { ...p.elements, [id]: atualizada } }`; os resolvedores são memoizados por objeto de projeto, então um objeto novo está certo).
Testes: `adjustStairFree` no Exemplo 1 (escada livre `[(0,0),(5,0)]`, w 1,2, H 2,80, criada com os padrões: 16 espelhos de 0,28) → a escada fica com 17 espelhos, `freePath` com o último ponto em (5,0), mensagem 'Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.', `undo` desfaz em UM passo; erro de tipo; `patchStairFree` mudando o deslocamento do topo regenera (N muda para H/maxRiser) numa só transação; erro de regeneração não grava.

### Passo 4: propriedades `apps/web/src/ui/StairProperties.tsx` e i18n `apps/web/src/editor/i18n.ts`
- i18n (pt e en, paridade exigida por `i18n.test.ts`; ponha perto das chaves `ramp_*`): `stair_shape_free` 'Livre' / 'Free'; `stair_adjust` 'Ajustar' / 'Adjust'; `stair_adjust_title` 'Ajusta o nº de espelhos, a altura e o piso da escada à regra de Blondel do tipo' / 'Adjusts the riser count, riser height and tread to the type Blondel rule'; `stair_free_group` 'Escada livre' / 'Free stair'; `stair_free_path_info` 'Trajeto: {n} pontos · {r} lances · {l} patamares' / 'Path: {n} points · {r} runs · {l} landings'; `stair_free_width` 'Largura do lance' / 'Run width'. Veja como as chaves com parâmetros são substituídas no resto do arquivo (se não houver padrão, use três chaves simples ou `.replace`).
- `StairProperties.tsx`: para UMA escada selecionada com `single.freePath` (≥ 2 pontos), acrescente depois do grupo "Restrições" um `Group` com título `t.stair_free_group` contendo: (a) `Row` só-leitura com `stair_free_path_info` (n = `freePath.length`; lances e patamares contados dos `components`); (b) `Row` "Largura do lance" com `NumField` (`id="p-sfreewidth"`, min 0,1, unidade m, valor = `measureFreeStair(single)?.width`) cujo `onCommit` roda `regenStairFree(single, p, { width: v })` e `applyStairFreeRegen(editor.store, single.id, r, 'Editar escada')`; erro → `useUi.setState({ status: 'Escada: <erro>' })`; (c) botão `id="p-sadjust"` classe `chiplink`, `title={t.stair_adjust_title}`, texto `t.stair_adjust`, com `onClick` que chama `adjustStairFree(editor.store, single.id)` e mostra `message` (ou `Escada: <erro>`) em `<div className="hint" role="status">` via `useState` (`adjustMsg`), exatamente como `RampProperties.tsx` (importe `t` e o hook do mesmo jeito que ele).
- Os campos que mudam a altura (tipo, nível base, nível de topo, desloc. da base, desloc. do topo, altura) de uma escada com `freePath` passam por `patchStairFree` em vez de `patchStairs` (erro → `useUi.setState({ status: 'Escada: <erro>' })`); com seleção múltipla ou sem `freePath` o comportamento atual NÃO muda.
- Teste (padrão de `RampProperties` se existir; senão teste da função pura/ação): o botão só aparece quando há `freePath`; i18n tem as 6 chaves nos dois idiomas.

## Arquivos
PODE criar: `packages/engine/src/stairFreeEdit.ts`, `stairFreeEdit.test.ts`; `packages/tools/src/stairFreeGrips.ts`, `stairFreeGrips.test.ts`; `apps/web/src/editor/stairFreeActions.ts`, `stairFreeActions.test.ts`.
PODE alterar: `packages/engine/src/index.ts` (só acrescentar), `packages/tools/src/selectGrips.ts`, `selectTool.ts`, `stairGrips.ts` (só ignorar `freePath`), `stairCommands.ts` (SÓ `updateStairComponents`), `packages/tools/src/index.ts` (só acrescentar), `apps/web/src/ui/StairProperties.tsx`, `apps/web/src/editor/i18n.ts`.
NÃO PODE tocar: `packages/model`, `packages/render`, `packages/io`, `packages/engine/src/{stairFree,stairLive,freePathGeom,rampFree,rampEdit}.ts`, `stairRunTool.ts`, `stairRunPlan.ts`, `stairLiveSession.ts`, `stairLiveMessages.ts`, `StairRunOptionsBar.tsx`, `createStairFromComponents`, `StairCreateOptions` (são da tarefa 2 ou do motor), nem expectativas de testes existentes.

## Verificar (dentro do worktree)
`npx vitest run packages apps/web` (tudo verde; teste de tempo que estourar sob carga: rode isolado e diga), `npx tsc --noEmit`, `npx eslint packages apps/web/src` (0 erros).

## Critérios de aceite
1. Mover um vértice por grip regenera a escada (componentes e `freePath`) em UMA transação; trajeto recusado não grava e explica.
2. Mudar tipo/níveis/altura/largura de uma escada livre a regenera (N, T medidos preservados enquanto válidos); "Ajustar" aplica `optimizeStair` em UMA transação e mostra a nota.
3. Editar o croqui à mão descarta o `freePath`; grips do croqui não aparecem em escada livre.
4. Escadas sem `freePath` e a rampa livre não mudam de comportamento (suítes existentes verdes).
5. i18n pt/en com paridade; commits em pt-BR, um por passo ("Adiciona regeneração da escada livre", "Adiciona grips de vértice da escada livre", "Adiciona ações de edição e ajuste da escada livre", "Mostra o grupo Escada livre nas propriedades"), sem push.

Termine com um RELATÓRIO FINAL curto: arquivos, API exportada, contagem de testes, decisões onde houve margem (por exemplo como `updateElements` trata `undefined`), desvios e pendências.
