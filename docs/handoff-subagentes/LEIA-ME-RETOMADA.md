# Retomada: rodada do perímetro/telhado/alinhar com subagentes opencode (2026-10-26/27)

Documento de passagem para continuar em outro PC. Escrito às pressas para o usuário desligar; tudo que estava solto foi commitado e enviado ao GitHub.

## 1. Onde está cada coisa (branches no GitHub: `origin`)

Base de tudo: `ccr-25143eb2-08pwa4`. A ponta dela JÁ contém o merge do perímetro (commit `54bb079`: perímetro, seleção/caixa, comandos dinâmicos, Rotacionar, Desconectar, telhado BIM em planta, esmaecimento visível) mais o trabalho de desempenho/esquadrias da outra sessão.

**Ainda NÃO está na `ccr` (a integrar):**
- `perim/integracao2` = `ccr@54bb079` + `perim/final` (correção `aberturas-acabamento`, ab9e1fa) + `perim/T2` + `perim/S` + `perim/TR` + `perim/AL`, com os conflitos TR×AL já resolvidos (`d3c8e02`).
- `perim/T1` (4 commits sobre `54bb079`): acabamento do telhado em planta (símbolo da empena, padrão da telha visível, rótulo de área fora da seta, contorno das paredes sob o telhado). **Não foi validado visualmente em tema escuro nem com a suíte completa; o agente T1 foi interrompido antes do relatório final.**

Branches individuais por agente (todas com commits próprios): `perim/A` realce/seleção · `perim/B` comandos dinâmicos · `perim/C` esmaecimento · `perim/D` itens menores · `perim/E` docs · `perim/F` telhado BIM · `perim/G` Selecionar no modo · `perim/H` Rotacionar · `perim/J` Desconectar · `perim/K` esmaecimento visível · `perim/S` snap das aberturas · `perim/T1` `perim/T2` telhado · `perim/TR` Aparar/Estender · `perim/AL` Alinhar universal · `perim/final` e `perim/integracao`(antiga) · `perim/integracao2`.

## 2. O que cada parte entregou

- **Seleção no esboço (A, G):** linha selecionada azul sólido com pontas e meio, hover azul claro, caixa de seleção (esq→dir contém, dir→esq cruza), Shift soma, Ctrl subtrai, Ctrl+A; Selecionar ativo no modo.
- **Comandos dinâmicos (B):** ligar Deslocar/Mover/Copiar/Rotacionar/Espelhar/Matriz/Excluir/Dividir/Aparar/Alinhar sem seleção prévia e escolher a linha; prévia do Deslocar; Tab alterna linha/laço conectado; barra de status com o próximo passo.
- **Rotacionar (H, J):** renomeado de Girar; opção "Desconectar" em Mover/Rotacionar/Espelhar (padrão: Mover e Espelhar mantêm vizinhas ligadas, como o Revit; Rotacionar solta). Deslocar, Aparar/Estender e Alinhar continuam esticando vizinhas.
- **Esmaecimento (C, K):** preenchimentos 0,60; traços e hachura 0,39 (`DIM_STROKE_RATIO = 0.65`) em `packages/render/src/plan/dim.ts`.
- **Telhado em planta (F, T1):** cor do material, tom por água na luz do sol do 3D, arestas finas, rincão tracejado, pegada por intervalo de vista, anotações sem sobreposição; T1 acrescenta empena, padrão da telha, rótulo e paredes sob o telhado.
- **T2:** mensagem do telhado que não fecha diz a causa e a saída. Limite de cantos agudos MANTIDO (≈11,5°; abaixo disso o beiral vira ponta de vários metros).
- **S (snap das aberturas):** cantos, centro, ombreiras, dobradiça e fim do arco de giro (`packages/tools/src/openingSnapPoints.ts`). O teste de desempenho `snapFaces.perf.test.ts` falhou (razão ~150–190 contra limite 30); o agente diz que já falha sem a mudança; **CONFERIR comparando com a base**.
- **TR:** Aparar/Estender com três modos (Ao canto, **Um elemento** padrão, Vários): estende uma parede até outra formando T sem alterar a outra (`packages/tools/src/trimTool.ts`).
- **AL:** Alinhar universal (`alignFeatures.ts`, `alignSolve.ts`, `alignApply.ts`, `alignTool.ts`): faces/eixos/núcleo/ponta de parede, ombreiras/centro de aberturas, arestas de piso/laje/telhado/forro/escada, linhas do esboço; "Preferir" Faces|Eixos|Núcleo, Tab, Ctrl múltiplo. Sem suporte: grade, ponta de parede em arco, abertura em parede curva. Sem cadeado (restrição permanente).

## 3. PARA CONTINUAR (ordem)

1. `git fetch origin && git checkout ccr-25143eb2-08pwa4 && git pull`, depois `npm install`.
2. Integrar: `git merge --no-ff perim/integracao2` e `git merge --no-ff perim/T1`. Conflitos esperados são poucos (roofs.ts se o D/F mexeram). Rodar o typecheck.
3. Validação final (não feita para o conjunto T1+S+TR+AL): `npm run typecheck && npm run lint && npx vitest run --maxWorkers=6` (com todos os workers o `apps/web/src/editor/shortcutConfig.test.ts` estoura timeout por contenção; isolado passa 11/11; vale subir o `testTimeout` desse arquivo), `npm run build`, depois os e2e em `tests/e2e/` (perimetro-realce, perimetro-selecao, perimetro-modificar, integracao-perimetro, desconectar, dim-capturas, telhados, telhados-formas, pisos, lajes, forro-ambiente, contorno, anexar, smoke). Olhar capturas dos telhados (4 águas, 2 águas, shed, L, arco) nos temas claro E escuro. `flow.mjs` já falhava na base (botão "Novo" da faixa antiga).
4. Comparar `packages/tools/src/snapFaces.perf.test.ts` na `ccr` sem e com `perim/S`.
5. Testes manuais que o usuário pediu para ver: T (Aparar/Estender modo Um elemento), Alinhar (face com face, ponta até face, porta até face, aresta de laje), snap nos cantos/ombreiras de portas e janelas, telhado pronto com empena.

## 4. Decisões já tomadas (não reabrir sem motivo)
3 arestas inclinadas = 3 águas + empena (padrão Revit). Telhado em L com 2 águas segue recusado, só a mensagem melhorou. Cantos agudos: manter o limite. Deslocar/Aparar/Alinhar esticam vizinhas; Mover/Espelhar mantêm vizinhas com opção Desconectar; Rotacionar solta por padrão.

## 5. Pendências conhecidas
Arco real no modelo (`Roof.boundary`; hoje vários lados curtos, alças só nos cantos). Cadeado do Alinhar (restrição). Linhas de grade como referência de alinhar. Ordem do Tab sobre porta começa numa candidata da parede hospedeira. Aparar/Estender sem `trimMode` cai em `varios` (só chamadas antigas). Modos antigos de criação (`poly`,`rect`,`walls`...) ainda existem (plano em `docs/pendencias-perimetro.md` §4). Baselines `visual-regression telhado-*` falham desde a mudança de largura 672→908 px (regenerar). Aviso de lint antigo em `OpeningFlipGrips.tsx` e `OpeningTempDims.tsx`.

## 6. Como relançar um subagente opencode (Windows)
Modelo: `opencode-go/deepseek-v4.1-flash` (NUNCA o pro; `deepseek/deepseek-flash` está sem saldo). Os prompts de todos os agentes estão em `docs/handoff-subagentes/*.md` e o lançador em `docs/handoff-subagentes/run-agent.ps1` (ajuste a variável `$sp` para a pasta dos prompts). Pontos que custaram caro: (1) a mensagem vai ANTES de `-f` (que é uma lista); (2) em `OPENCODE_PERMISSION` a ÚLTIMA regra que casa vence, então `"*":"deny"` vem primeiro, senão o agente fica sem shell; (3) o agente não pode escrever fora do worktree (Temp é negado): scripts temporários em `tests/e2e/_tmp-*.mjs`; (4) não existe `grep` no shell do Windows; (5) nunca rodar `git config` sem `--worktree` (grava no `.git/config` compartilhado); (6) cada agente em um worktree próprio (`git worktree add ../hestia-X -b perim/X <base>` + `npm ci`).

## 7. Trabalho de outras sessões (também enviado)
Havia alterações não commitadas em outras pastas/worktrees (desempenho GPU `gpu-r2/r3/r5`, `perf-web-20-pavimentos`, `baseline`, `BRD`, agentes antigos). Foram commitadas como snapshots `wip(snapshot)` nas próprias branches e enviadas; branches destacadas ganharam o nome `wip/<pasta>`. Um `stash` antigo (`wip angularNode`) virou a branch `wip/stash-angularNode`. Nada foi mesclado nem descartado: revisar uma a uma.
No checkout principal havia uma correção em andamento do buffer numérico que prendia atalhos (`apps/web/src/editor/controller.ts` + teste `atalhoBufferPreso.test.ts`) e o script solto `packages/model/src/.edit_room_sep.cjs`; foram commitados como `wip:`.
