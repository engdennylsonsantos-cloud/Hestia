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
    npm run perf:browser -- --save        # exige apps/web/dist (npm run build) ou APP_URL; ver a seção Navegador abaixo

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

- (Resolvido em investigação posterior, ver "Planta quente e fria" abaixo.)
- `ModelScene.update` quase não melhora com o cache de parede aquecido (frio e quente têm a mesma ordem de grandeza).
  Ou o cache não cobre a montagem inteira, ou o custo está fora dele.
- O p95 de `pickModelPoint` na grade (cerca de 3,3 a 3,9 ms) é parecido nos dois projetos e muito acima da mediana (cerca de
  0,2 ms). Hipótese, não verificada: o `updateMatrixWorld` do modelo inteiro que o pick faz a cada clique.

## Planta quente e fria (investigação)

A anomalia de planta quente mais lenta que a fria (node-2026-10-24, commit f7e1cef) não se repete no código atual
(dc0c10b). Medido no mesmo ambiente, 20 pavimentos: frio ~45 ms, quente ~12 ms por nível (`bench-interacao`); experimento
por nível com frio antes do quente: quente ~12 ms, frio ~100 ms (máquina com outros agentes). Não há bug de cache no
caminho quente: a vista do projeto (`planViewOf`) e o cache de hachuras são por objeto, e o quente reaproveita o mesmo
projeto. O número de f7e1cef veio de código anterior (`2d16475`, `3fe3ef5`, planta com contexto da vista e cache de
contornos) e de máquina carregada; a causa exata daquela medida não foi reproduzida. Nenhuma mudança no método do bench.

## Navegador (f67e2f0, produção)

Arquivo: `browser-20-pav-2026-10-25-antes.json` (rótulo `antes`, `PERF_RUNS=5`). Gerado no worktree detached de f67e2f0
com `npm run build` e `tests/e2e/perf-browser.mjs` (cópia do script de dc0c10b; o roteiro não mudou). Chrome 155, headless,
Xeon E5-2620 v3, Windows 10, 15,8 GB RAM. Medianas e p95 em ms:

| Medida | 10 pavimentos | 20 pavimentos |
|---|---|---|
| Abrir projeto (até o 2º quadro) | 1358,8 / 1424,5 | 1680,6 / 1846,9 |
| Carregar página até app pronto | 1894 / 1981 | 1060 / 1197 |
| Primeira pintura (FCP) | 1012 / 1032 | 644 / 736 |
| Planta do nível do meio | 72,0 / 241,4 | 74,7 / 235,6 |
| Seleção por clique na planta | 44,2 / 71,8 | 32,9 / 70,7 |
| Edição de parede (setWallEnds) | 181,1 / 400,7 | 235,7 / 426,4 |
| Pan (300 quadros) | 30,8 / 37,9 | 22,0 / 32,3 |
| Zoom (150 quadros) | 35,8 / 43,6 | 23,0 / 37,5 |
| Pick 3D (20 cliques) | 27,5 / 32,7 | 50,8 / 57,0 |

Sem pendências. Os caminhos do roteiro existiam no f67e2f0 (aba "Modelo 3D" no navegador de projeto, ganchos `__hestia` e
`__hestia3dModel`), então o script rodou sem ajuste. Números de 5 repetições: a planta do nível do meio e a edição têm
variação alta (p95 cerca de 3 vezes a mediana).
