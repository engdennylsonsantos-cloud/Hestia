# Tarefa E-livre 1 (Sonnet): motor puro da escada livre

Trabalhe SÓ no worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\e-motor` (branch `feat/e-stairfree-motor`), criado a partir do `integ2` MAIS a mescla de `feat/e-stairfree-model` (o modelo já tem `StairGenerator` com `'free'`, `Stair.freePath?` e `Stair.manualLandings?`). Se o worktree ainda não tem o modelo, faça `git merge feat/e-stairfree-model` antes de começar (se não existir a branch, pare e diga no relatório). Sem push, sem `npm install` (dependências ligadas). Preserve finais de linha CRLF: edite pelas ferramentas de edição e confira com `git diff` que só as linhas pretendidas mudaram (se um arquivo virar LF, restaure CRLF). Comentários em pt-BR, no estilo do código em volta.

Leia ANTES, inteiro: `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\contrato-escada-livre.md` (seções 0, 1, 2, 3, 4, 10, 11 mandam nesta tarefa). Leia também o código que você vai espelhar: `packages/engine/src/rampFree.ts`, `rampLive.ts`, `rampPlan.ts` (`inlineLanding`), `stairGenerators.ts` (`generateStraightRun`, `treadFor`, `treadRuleOf`, `riserCountFor`), `stairNorms.ts`, `stairs.ts` (`resolveStairOne`), `stairSketch.ts` (`stairLandingPolygon`) e os testes `rampFree.test.ts`, `rampLive.test.ts`.

## Contexto
O Hestia (monorepo TypeScript: packages/model, engine, tools, render, io, apps/web; vitest) já tem a RAMPA LIVRE: o usuário clica um trajeto (polilinha), cada trecho vira um lance, cada vértice com giro vira patamar de giro com mitra, e a ferramenta diz ao vivo quanto falta. Queremos o MESMO para ESCADAS ("escada livre"). Esta tarefa é só o motor puro (engine): nada de ferramenta, interface nem modelo. Regras fechadas: Blondel por tipo (`treadFor`); N = ceil(H ÷ espelho máx), h = H ÷ N, piso T = `treadFor(h, regra do tipo)`; patamares só nas curvas e quando o lance passa do máximo de espelhos por lance da norma; sem leque.

## O que fazer (nesta ordem; um commit por passo)

### Passo 1: extrair o auxiliar compartilhado (sem mudar a rampa)
Crie `packages/engine/src/freePathGeom.ts` com (mova de `rampFree.ts`, mesmo código, mesmos valores):
- `export const FREE_COLLINEAR_ANGLE`, `FREE_MAX_TURN_ANGLE` (3° e 150° em rad), `FREE_OVERLAP_AREA = 1e-3`.
- `turnTMin(theta, width) = (width/2)*Math.tan(theta/2)`.
- `turnLandingRing(v, dA, dB, width, tIn, tOut = tIn): Vec2[]`: os 6 pontos `[aIn, inner, bIn, bOut, outer, aOut]` da fórmula de `turnLanding` de `rampFree.ts`, mas com `tIn` no lado do trecho A e `tOut` no lado do trecho B (`aIn = v − dA·tIn + nA·h`, `aOut = v − dA·tIn − nA·h`, `bIn = v + dB·tOut + nB·h`, `bOut = v + dB·tOut − nB·h`; `h = sgn·width/2`, `sgn = cross(dA,dB) ≥ 0 ? 1 : −1`, `miter = (nA+nB)·h/(1+nA·nB)`, `inner = v+miter`, `outer = v−miter`, `nA = perp(dA)`).
- `turnLandingSketch(v, dA, dB, width, tIn, tOut = tIn): StairComponentSketch` (`{ kind:'landing', landing:{ boundary } }`, arestas retas `sag: 0`, anel CRU, igual ao atual).
- `compactRing(ring: Vec2[], eps = 1e-9): Vec2[]`: tira pontos consecutivos repetidos (distância < eps), inclusive o último igual ao primeiro.
- `partRing`, `findSelfOverlap(parts, segOf)` (movidos).
Em `rampFree.ts` troque o código movido por imports (`turnLandingSketch(tr.v, tr.dA, tr.dB, w, tr.t)`, `findSelfOverlap`, constantes) e REEXPORTE as duas constantes: `export { FREE_COLLINEAR_ANGLE, FREE_MAX_TURN_ANGLE } from './freePathGeom.ts';` (o `export *` do `index.ts` continua achando). No `index.ts` do engine acrescente só exports nomeados: `export { turnLandingRing, turnLandingSketch, compactRing, turnTMin, findSelfOverlap } from './freePathGeom.ts';`. NÃO use `export *` do novo arquivo. NÃO mexa em `rampLiveSession.ts` (ferramentas).
Teste novo `freePathGeom.test.ts`: anel com `tIn = tOut` igual ao que `planRampFree` gera (compare o contorno do patamar de um L de rampa com `turnLandingSketch`); exemplo do contrato (Exemplo 2: v=(3,0), dA=(1,0), dB=(0,1), w=1, tIn=0,76, tOut=0,5 → aIn=(2.24,0.5), aOut=(2.24,−0.5), bIn=(2.5,0.5), bOut=(3.5,0.5), inner=(2.5,0.5), outer=(3.5,−0.5)); `compactRing` desse anel dá 5 pontos; giro à direita espelha o sinal. Os testes atuais de rampa devem passar SEM mudar expectativa.

### Passo 2: `packages/engine/src/stairLive.ts`
Implemente exatamente a API e as regras da seção 2.2 do contrato: `STAIR_COUNT_EPS`, `StairFixed`, `StairLiveParams`, `stairLiveParams`, `StairLayoutPiece`, `StairSegmentLayout`, `layoutStairSegment(span, p, need = Infinity, balanceTail = true)`, `StairRemaining`, `liveStairRemaining`, `StairDistribution`, `distributeRisers`. Resumo da regra do layout:
```
pos = 0; rem = span; left = need
até 200 voltas:
  cap = rem < 0 ? 0 : floor(rem / T + 1e-9) + 1
  n = min(cap, M, left); se n < 2: pare
  se balanceTail e left − n === 1: se n − 1 ≥ 2 então n −= 1; senão leftover1 = true
  emita lance {at: pos, length: (n−1)·T, risers: n}; pos += (n−1)·T; rem −= (n−1)·T; left −= n
  se left < 2: pare (nunca patamar sem um lance de ≥ 2 espelhos depois); se n < M: pare; se rem < P + T − 1e-9: pare
  emita patamar {at: pos, length: P}; pos += P; rem −= P
```
`stairLiveParams(H, type, { fixed, width, norms })`: `N = fixed?.risers ?? riserCountFor(H, type.maxRiser)` (N < 2 ou H ≤ 0 → `{ error }` pt-BR: 'A altura é menor que um espelho: nada a gerar.'), `h = H/N`, `T = fixed?.tread ?? treadFor(h, treadRuleOf(type))`, `M = max(2, floor(norms.maxRiseBetweenLandings / h + 1e-9))`, `landingLength = max(norms.landingMinLength, width ?? 0)`. `norms` padrão `DEFAULT_STAIR_NORMS`.
Testes `stairLive.test.ts` (numéricos, do contrato):
- Tipo `stt_monolitica` (`DEFAULT_STAIR_TYPES`), H = 2,80: N = 16, h = 0,175, T = 0,28, M = 18. `layoutStairSegment(5, p, 16)` = 1 lance de 16 espelhos, `length` 4,20 (4,2 ± 1e-9). `layoutStairSegment(1.5, p, 7, false)` = 1 lance de 6 espelhos. `layoutStairSegment(0.1, p)` = nenhuma peça. `layoutStairSegment(Infinity, p, 7)` = lance de 7, `length` 1,68.
- H = 3,60: N = 20, h = 0,18, T = 0,28 (sobe ao mínimo), M = 17: `layoutStairSegment(7, p, 20)` = lance 17 (length 4,48) + patamar (at 4,48; length 1,20) + lance 3 (at 5,68; length 0,56). Com `need = 18`: lances 16 + 2 (regra do resto). Com `need = 18` e `balanceTail = false`: só o lance de 17 (sem patamar, `risers` 17; o 18º fica para a extensão).
- `liveStairRemaining` com `params` do H = 2,80, `risersBefore = 0`: span 3,0 → `falta` 5, `faltaLength` 1,4; span 4,2 → `alcancado`; span 4,2 − 1e-12 → `alcancado`; span 5,0 → `passou`, `excess` 2, `closeAt` 4,2. Com `risersBefore = 9`, span 0,5 → placed 2 → `falta` 5.
- `distributeRisers([2.5, 1.5], p)` (exemplo 2, sem o último vão ser o ajuste): ver passo 3. `distributeRisers([2.4, 0.1, 2.4], p)` (exemplo 3) → layouts de 9, 0 e 7 espelhos, `closedAt` 2, `missing` 0. `distributeRisers([2.4, 1.5], p)` → 9 + 6, `closedAt` null, `missing` 1 (o último vão não rebalanceia). `distributeRisers([0.1, 2.4], p)` → 1º vão vazio.
- `stairLiveParams`: tipo inexistente/H ≤ 0/N < 2 dão `{ error }`; `fixed: { risers: 17, tread: 0.3125 }` dá h = H/17.

### Passo 3: `packages/engine/src/stairFree.ts`
Implemente a seção 2.3 do contrato: `StairFreeOptions`, `StairFreePlan`, `StairFreePlanResult`, `TurnRecuo`, `turnRecuo`, `SegmentFit`, `fitSegment`, `planStairFree`, e o otimizador `OptimizeStairInput`, `OptimizeStairResult`, `optimizeStair`. Siga os passos 1 a 9 do contrato à risca. Pontos que costumam dar erro:
- Índices: erros de vértice usam a posição 1-based no trajeto ORIGINAL; guarde `orig[]` ao limpar e dissolver.
- A folga do trecho vai para o recuo de ENTRADA do patamar (`tIn = len_k − (bIn + lay.length)`), o recuo de SAÍDA é o `bIn` do próximo trecho. Para um trecho `pass`, o retângulo vai de `bIn` a `len − aOut`; os dois patamares de giro usam `aOut`/`bIn` desse trecho.
- A saída dos patamares de giro usa `compactRing(turnLandingRing(...))`; monte o `boundary` com arestas retas `sag: 0`.
- Lance: `generateStraightRun({ start: at(u, 0), dir: d, width: w, risers: n, tread: T })` com `at(u, v) = P_k + d·u + perp(d)·v`. Patamar em linha: `inlineLanding(at, u0, u0 + P, −w/2, w/2)` (de `rampPlan.ts`, já exportado).
- `segOf[]` (índice do trecho de cada componente) alimenta `findSelfOverlap`; componentes do mesmo trecho nunca se comparam.
- `extended`/`slack`/`path`/`note`: nunca devolva `NaN`; `note` só quando algo mudou (textos exatos na seção 4 do contrato e abaixo).
- Nenhuma exceção escapa: envolva a geração em `try/catch` e converta `RangeError` em `{ error }`.
Mensagens (pt-BR, exatas): 'A largura do lance deve ser positiva.'; 'A altura deve ser positiva: nada a gerar.'; 'O trajeto precisa de ao menos dois pontos distintos.'; `Retorno agudo demais no vértice ${k}: use dois giros menores.`; `O trecho ${k} é curto demais para o patamar de giro.`; 'O 1º trecho é curto demais para um lance (mínimo 2 espelhos).'; `Poucos espelhos (${N}) para o patamar de giro no vértice ${k}: alongue o trecho ${k - 1} ou use uma escada reta.`; `O trajeto se sobrepõe ao trecho ${j}: afaste o ponto.`; notas: `Trajeto estendido em ${m} m para completar ${N} espelhos.` (m com vírgula, 2 casas); `Trajeto encurtado: a escada fecha no espelho ${N}, antes do último ponto.`; `A escada termina ${m} m antes do último ponto.` (só se `slack > 0,005` e não truncado).
Testes `stairFree.test.ts` (use `DEFAULT_STAIR_TYPES`, `stt_monolitica`):
- Exemplo 1: `[(0,0),(5,0)]`, w 1,2, H 2,80 → N 16, T 0,28, 1 lance de 16 espelhos, `path` = `[(0,0),(4.2,0)]` (±1e-9), `slack` 0,80, `extended` 0, nota 'A escada termina 0,80 m antes do último ponto.'. Com H 3,60 e `[(0,0),(7,0)]`: lances de 17 e 3 espelhos e 1 patamar em linha (`landings` 1).
- Exemplo 2: `[(0,0),(3,0),(3,2)]`, w 1,0, H 2,80 → lance(9), patamar de giro, lance(7); último ponto do `path` = (3, 2,18); `extended` 0,18; primeiro lance com último espelho em x = 2,24; anel do patamar compactado com 5 pontos (2.24,0.5),(2.5,0.5),(3.5,0.5),(3.5,−0.5),(2.24,−0.5).
- Exemplo 3: `[(0,0),(3,0),(3,1.3),(0,1.3)]`, w 1,2 → lance(9), giro, passagem (retângulo de 0,1 m), giro, lance(7); último ponto (0,72; 1,3); `slack` 0,72; 5 componentes; `landings` 3; `runs` 2.
- Um teste por linha da tabela de bordas (seção 4 do contrato): 1 ponto, 2 pontos iguais, trecho único igual à reta (compare com N, h, T de `riserCountFor`/`treadFor`), trecho curto demais entre curvas, 1º trecho curto, último trecho curto estendido, retorno agudo (θ = 170°), vértice colinear dissolvido (θ = 2°) e com `manualLandings: [1]` vira retângulo, trajeto longo fecha antes (vértices depois saem do `path`, `truncated` true, nota), trajeto curto estende, sobreposição (laço em espiral quadrada fechando sobre si), N pequeno (H = 0,35: N = 2, L de trechos curtos), `fixed`.
- Integração com o modelo: monte um `Project` mínimo (use o helper de projeto dos testes de `stairs.test.ts`), crie uma `Stair` com `makeStair` e `components` convertidos do plano (`id`, `kind`, `generatedBy: 'free'`) e confira `resolveStairOne`: `riserCount === N`, `riserHeight ≈ H/N`, nenhum issue com `severity: 'error'`, nenhum `stair-blondel` quando T vem do `treadFor`, e `stairLandingPolygon` de cada patamar sem `issues`.
- `optimizeStair`: Exemplo 1 de Ajustar: `[(0,0),(5,0)]`, H 2,80 → `fixed` { risers: 17, tread 0,3125 } (±1e-6), `gap` ≈ 0, `violation` 0, nota 'Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.'; trajeto de 4,0 m reto: N sobe até caber (documente o N obtido no teste e confira que Blondel e `riserMin`/`riserMax` valem); tipo com faixa Blondel vazia (mude `calcMin`/`calcMax` do tipo para uma faixa impossível) → `violation > 0` e `messages` não vazio; nunca devolve plano com erro quando `Nmin` tem plano.
- Propriedade (`stairFreeProps.test.ts`), seção 11 do contrato (gerador mulberry32, semente fixa, 300 trajetos). Falhas devem imprimir a semente e o trajeto.
- Desempenho (`stairFreeBench.test.ts`): `planStairFree` com 12 vértices e N = 40 em < 50 ms (mediana de 20 execuções); `optimizeStair` com 10 vértices em < 400 ms. Use limites folgados; se o teste de tempo oscilar sob carga rode-o isolado e diga no relatório.

Exporte tudo no `index.ts` (`export * from './stairLive.ts'; export * from './stairFree.ts';`), conferindo que não há nomes duplicados com outros arquivos do engine (`grep -rn "export .* layoutStairSegment\|STAIR_COUNT_EPS" packages/engine/src`).

## Arquivos
PODE criar: `packages/engine/src/{freePathGeom,stairLive,stairFree}.ts` e os testes `freePathGeom.test.ts`, `stairLive.test.ts`, `stairFree.test.ts`, `stairFreeProps.test.ts`, `stairFreeBench.test.ts`.
PODE alterar: `packages/engine/src/rampFree.ts` (só a extração), `packages/engine/src/index.ts` (só acrescentar linhas).
NÃO PODE tocar: `packages/model`, `packages/tools`, `packages/render`, `packages/io`, `apps/web`, `rampLive.ts`, `rampPlan.ts`, `rampEdit.ts`, `stairGenerators.ts`, `stairs.ts`, `stairIssues.ts`, nem testes existentes (nenhuma expectativa muda).

## Verificar (dentro do worktree)
`npx vitest run packages apps/web` (tudo verde; se um teste de tempo estourar sob carga rode-o isolado e diga), `npx tsc --noEmit`, `npx eslint packages apps/web/src` (0 erros).

## Critérios de aceite
1. A extração não altera a rampa: `rampFree.test.ts`, `rampLive.test.ts`, `rampEdit.test.ts` e demais testes de rampa verdes sem mudança.
2. Os 3 exemplos do contrato batem com os números acima.
3. A propriedade dos 300 trajetos passa; nenhum plano tem lance de 1 espelho, polígono autointerceptante nem sobreposição.
4. `optimizeStair` e `planStairFree` nunca lançam exceção.
5. Sem import de `@hestia/tools` nem de `apps/web`; sem `resolveStairs` dentro de `stairLive.ts`.
6. Commits em pt-BR (um por passo: "Extrai auxiliar de patamar de giro da rampa livre", "Adiciona layout e restante em espelhos da escada livre", "Adiciona planejamento e otimizador da escada livre"), sem push.

Termine com um RELATÓRIO FINAL curto: arquivos criados/alterados, assinaturas exportadas, resultados numéricos dos 3 exemplos, contagem de testes, decisões tomadas onde o contrato deixou margem, desvios do contrato (se houver) e pendências.
