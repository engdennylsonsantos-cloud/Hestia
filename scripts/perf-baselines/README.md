# Baseline de desempenho (frente G)

"Antes" e "depois" para as mudanças de interação. Dois tipos de medição, que não se comparam entre si:

- **Node** (`scripts/bench-interacao.mts`): CPU pura, sem navegador, sem GPU, sem pintura. Mede o motor (planta, resolução
  de pisos, lajes e telhados), a montagem da cena 3D em geometria e o picking por raio. Arquivo: `node-<data>.json`.
- **Navegador** (`tests/e2e/perf-browser.mjs`): o que o usuário sente (abertura, quadros de pan e zoom, clique de pick
  na 3D), com o Chrome ou Edge reais. Arquivo, quando houver: `browser-<data>-producao.json`.

O Node mede o trabalho do JavaScript; o navegador mede o trabalho do JavaScript mais pintura, GPU e o custo de manter a
página. Um ganho no Node não garante ganho no navegador, e um número do navegador não se atribui a uma função só.

## Como reproduzir

    npm run bench:interacao -- --save     # grava scripts/perf-baselines/node-<data>.json
    npm run perf:browser -- --save        # exige apps/web/dist (npm run build) ou APP_URL; ver PENDENTE abaixo

Variáveis: `BENCH_RUNS` (medidas por cenário, padrão 30); `CHROME_PATH` (Chrome ou Edge, se não estiver nos caminhos
padrão); `PERF_RUNS` (repetições do navegador, padrão 5); `PERF_HEADED=1` (janela visível); `APP_URL` (servidor de dev:
só para testar o roteiro, o resultado não é baseline).

Projeto sintético: `projeto-sintetico.mts`, o mesmo gerador para os dois. Layout fixo, sem sorteio (32 paredes por
pavimento, uma porta, um piso e uma laje por nível, cobertura no topo). Dez pavimentos têm 320 paredes; vinte, 640.

Navegador, roteiro (`tests/e2e/perf-browser.mjs`, agora com 10 e 20 pavimentos): abrir o projeto (até o segundo quadro);
planta do nível do meio (troca de nível até o quadro); seleção por clique na planta (pointerup até a seleção mudar e um
quadro); edição (`setWallEnds` pelo store, a parede de índice 25 do nível do meio, ida e volta); pan; zoom; pick 3D. Cada
um sai com mediana, p95, média, mínimo e máximo. O arquivo gravado é `browser-20-pav-<data>-<PERF_ROTULO>.json`
(padrão `antes`). Com `--save` e servidor de desenvolvimento, não grava (sai com código 3).

## Método (Node)

- Aquecimento de 5 execuções fora das medidas; depois 30 medidas (`BENCH_RUNS`). Cenário de cena 3D: 10 medidas.
- Mediana, p95 (amostra de ordem `ceil(0,95·n)`), média, mínimo e máximo, em ms.
- "Frio": projeto de geometria nova (chave de cache inédita), com a resolução prévia fora do cronômetro.
  "Quente": o mesmo projeto, redesenho.
- Picking: um clique de exemplo (centro da tela, com a câmera enquadrada por `scene.fit()`) e uma varredura de 9 pontos.

## Máquina e commit

- Windows 10 Pro 10.0.19045 x64; Intel Xeon E5-2620 v3 2,40 GHz, 12 threads lógicas; RAM 15,8 GB (cerca de 6,9 GB livres
  no início); Node v24.14.1.
- Commit medido: `f7e1cefa76ce6e6e9c94791757db05f96e5cd1ad` (HEAD do worktree). O código de produto é o desse commit;
  o JSON foi gravado com os scripts novos ainda sem commit (`arvoreSuja: true`).
- Outros agentes rodavam no mesmo computador durante a medição: há ruído, sobretudo nas medianas de 20 pavimentos.

## Resultados Node (ms, mediana / p95)

| Medida | 10 pavimentos | 20 pavimentos |
|---|---|---|
| Soma das medianas de `buildPlanDrawList` nos níveis, frio | 688 | 755 |
| Soma das medianas de `buildPlanDrawList` nos níveis, quente | 219 | 1065 |
| Maior `buildPlanDrawList` de um nível, frio | 78 | 78 |
| `resolveFloors` + `resolveSlabs` + `resolveRoofs` (soma por nível), frio | 1,1 | 3,3 |
| `ModelScene.update`, frio | 4482 / 5027 | 9145 / 9792 |
| `ModelScene.update`, quente (mesma cena) | 4090 / 9513 | 8173 / 9072 |
| `pickElement`, centro da tela | 0,39 / 1,35 | 0,45 / 0,91 |
| `pickModelPoint`, centro da tela | 4,00 / 7,06 | 3,17 / 3,80 |
| `pickElement`, grade 3×3 | 0,15 / 0,32 | 0,31 / 0,53 |
| `pickModelPoint`, grade 3×3 | 0,16 / 3,34 | 0,27 / 3,93 |

Clique de exemplo: 10 pavimentos acerta a parede `perf_w_6_2`; 20 pavimentos acerta `perf_w_11_2` (ambas `wall`).
O JSON tem a tabela completa, nível por nível, com `frio`, `quente`, mínimo e máximo.

Observações que o baseline não explica (não as corrigi, só registro):

- A planta "quente" é mais lenta que a "fria" em vários níveis de 20 pavimentos (soma de 1065 contra 755 ms). Não sei a
  causa; pode ser ruído de máquina compartilhada ou um custo por quadro que a medida fria não paga. Investigar antes de
  usar esse número como alvo.
- `ModelScene.update` quase não melhora com o cache de parede aquecido (frio e quente têm a mesma ordem de grandeza).
  Ou o cache não cobre a montagem inteira, ou o custo está fora dele.
- O p95 de `pickModelPoint` na grade (cerca de 3,3 a 3,9 ms) é parecido nos dois projetos e muito acima da mediana (cerca de
  0,2 ms). Hipótese, não verificada: o `updateMatrixWorld` do modelo inteiro que o pick faz a cada clique.

## Navegador: PENDENTE

Não há número de navegador. Motivo:

- Chrome 155 existe em `C:\Program Files\Google\Chrome\Application\chrome.exe` e o Edge em `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`: o navegador não é o problema.
- `apps/web/dist` não existe: `npx vite build` falha neste worktree com
  `[vite:esbuild-transpile] remove ...esbuild-<hash>: Acesso negado`, ao apagar um arquivo temporário do esbuild. Repeti
  com TEMP padrão, com TEMP em outra pasta e após parar o servidor de dev, sem sucesso. É um problema do ambiente
  (permissão de exclusão no Windows), não do código. Com build de produção, `npm run perf:browser -- --save` gera o
  JSON; sem ele o script sai com código 2 e a mensagem PENDENTE.
- Validação do roteiro: rodei o script contra o servidor de dev (`APP_URL`). Abriu o projeto de 10 pavimentos, mediu
  abertura, pan, zoom e pick (sem `--save`, nada gravado). Esses números são de modo dev (React sem otimização) e não entram como baseline.

Nova tentativa (2026-10-24, branch `worktree-agent-a2f7bc46ff7082796`, em f67e2f0): `npm run build` falhou de novo com o
mesmo `Acesso negado` do esbuild, em três tentativas (inclusive com TEMP em outra pasta). Não há `apps/web/dist` neste
worktree, então o baseline de navegador de 10 e 20 pavimentos continua PENDENTE.

Para fechar o baseline de navegador: resolver o build no Windows (antivírus ou permissão na pasta temporária do
esbuild), rodar `npm run build`, e depois `npm run perf:browser -- --save`.
