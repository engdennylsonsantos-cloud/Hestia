# Relatório da tarefa F1 · Portas novas

## O que foi feito

Implementei as cinco famílias de porta da spec E §3.5 de ponta a ponta: modelo único, planta, linhas de
abertura, corte/elevação (via peças do modelo), 3D, IFC e catálogo. As famílias já registradas foram
respeitadas; não mexi em janelas, ferramentas, diálogo nem no símbolo de planta antigo.

- **Vai-e-vem (`dblact`)**: batente simples, uma folha centrada (dobradiça em `h`) ou duas (uma em cada
  ombreira), giro em `z` nos dois sentidos, `LeafOpening.both = true`. Planta com dois arcos e a folha
  aberta dos dois lados; linhas de abertura com o V contínuo e o tracejado superpostos.
- **Embutir (`pocket`)**: batente simples com a travessa e só a ombreira do lado oposto à cavidade; folha
  que desliza `travel = largura da folha` em `t`; peça `pocket` tracejada e fixa. Planta com folha fechada,
  cavidade tracejada e seta; linha de abertura com seta para a cavidade.
- **Dobrável (`bifold`)**: 2 painéis (cadeia ancorada em `h`) ou 4 (duas cadeias, uma em cada ombreira),
  `motion = fold`, trilho no topo. Planta com os painéis dobrados (zigue-zague); linhas de abertura em
  zigue-zague, sem V. Ângulos padrão 70° (3D) e 55° (planta).
- **Sanfonada (`accordion`)**: cadeia única de 9 painéis, `fold`, sem maçaneta. Ângulo 3D padrão 75°.
- **Seccionada (`garage`)**: cinco faixas horizontais de folha com almofadas de relevo, batente simples,
  trilhos laterais tracejados e `slide` vertical (`dz = 1`, `travel = H`, `slideAxis = 'z'`,
  `kind = 'overhead'`). Planta com a linha da folha fechada e o retângulo tracejado do painel recolhido;
  linhas com as juntas horizontais e seta para cima.

## Arquivos tocados

Novos:
- `packages/engine/src/openingModelDoorsNew.ts`
- `packages/engine/src/openingModelDoorsNew.test.ts`
- `RELATORIO.md`

Modificados:
- `packages/engine/src/openingModel.ts` (import + despacho de uma linha para as famílias novas dentro de
  `buildDoor`; `partTransformed` e `foldPoint` intactos)
- `packages/engine/src/openingPlan.ts` (+ teste) — blocos novos para as cinco famílias
- `packages/engine/src/openingLines.ts` (+ teste) — V duplo do vai-e-vem, seta do embutir, zigue-zague das
  dobráveis/sanfonadas e juntas/seta da seccionada
- `packages/render/src/model3d/openingParts.ts` (+ teste) — codificação do `fold` no pivô existente
- `packages/render/src/section/build.ts` (+ teste) — peças `dashed` (cavidade e trilhos) saem tracejadas
- `packages/io/src/ifc/ifcExport.ts` (+ teste) — `Operation` das famílias novas
- `packages/model/src/defaults.ts` — 5 tipos novos no fim da lista de portas
- `packages/model/src/opening.test.ts` — catálogo dos tipos novos
- `packages/render/src/model3d/openingParts.test.ts` — contagem do catálogo 14 → 19 e testes das famílias

## Testes

Comandos executados com sucesso:

- `npx vitest run packages/engine/src/openingModelDoorsNew.test.ts packages/engine/src/openingModel.test.ts packages/engine/src/openingPlan.test.ts packages/engine/src/openingLines.test.ts packages/render/src/model3d/openingParts.test.ts packages/render/src/section/build.test.ts packages/model/src/opening.test.ts packages/io/src/ifc/ifcExport.test.ts`
- `npx vitest run --exclude "**/property.test.ts" --exclude "**/*perf.test.ts"` → **435 arquivos, 5044
  testes, todos verdes**
- `npx tsc -p tsconfig.json --noEmit` → limpo
- `node scripts/check-boundaries.mjs` → `fronteiras ok`

Cobertura dos critérios de aceitação:
- modelo: ids únicos/estáveis, caixas válidas, dentro do vão (exceto `pocket`/acabamentos), folha fechada
  sem volume comum com batente, `openings[]` com `kind`/`both`/`slideAxis`;
- `partTransformed`: vai-e-vem nos dois sentidos, embutir com `travel` e cavidade contendo a folha aberta,
  cadeia dobrável contínua (comprimento preservado e ponta recuando em `cos θ`), sanfonada com 9 painéis,
  seccionada subindo `travel` em `z`;
- planta mid/high: dois arcos do vai-e-vem, cavidade tracejada, zigue-zague com o número certo de painéis,
  retângulo tracejado da seccionada;
- `openingLinePaths`: V duplo, seta do embutir, zigue-zague sem V e juntas/seta da seccionada; nada nas
  fixas;
- 3D: todas as peças, abertura mudando a posição, peças dentro do vão e pivô do `fold` coincidindo com
  `partTransformed`;
- IFC: `DOUBLE_SWING_LEFT/RIGHT`, `SLIDING_TO_LEFT/RIGHT`, `FOLDING_TO_LEFT/RIGHT`, `SECTIONAL_OVERHEAD`;
- catálogo: os 5 tipos passam por `openingTypeIssue`, caem na família certa e geram modelo.

Teste existente atualizado: `packages/render/src/model3d/openingParts.test.ts` passou a esperar 19 tipos
padrão (eram 14) por causa dos 5 tipos acrescentados. Nenhum teste foi apagado.

## Decisões e divergências da spec

- **Cavidade da porta de embutir**: a spec diz `t` de `±hw` até `±(hw + largura da folha)`, mas com
  `travel = largura da folha` e a folha centrada em `C` isso não conteria a folha aberta (o início da folha
  fica em `±(hw − J)`). Para cumprir o critério “a cavidade contém a folha aberta”, a peça `pocket` começa na
  face interna da ombreira, `±(hw − J)`, e termina em `±(hw − J + largura)`. A folha aberta fica exatamente
  contida nela.
- **Trilhos da seccionada**: modelei como duas faixas finas nas laterais, na altura do vão e indo para o
  lado de abertura por `min(H, 2,5)` em `s`; na planta aparecem como linhas tracejadas nesse sentido.
- **Linhas das dobráveis/sanfonadas**: como `openingLinePaths` trabalha em (u, z), o “zigue-zague dos
  painéis dobrados” foi desenhado como uma polilinha de uma junta por painel alternando topo/base da
  folha; não há V.
- **`TypePreview.tsx` não foi alterado**: ele não tem `switch` por símbolo novo que precisasse de caso
  próprio; as prévias continuam usando o desenho genérico de folhas.
- **Seccionada aberta no 3D**: por spec `travel = H`, então a folha aberta sobe acima do vão (é o
  comportamento de portão seccionado). Os testes de confinamento fechado não incluem as faixas abertas
  dessa família; as demais famílias ficam dentro do vão também abertas (exceto a folha do embutir, que vai
  para a cavidade, e a projeção/trilhos por definição).

## Pendências honestas

- Não houve validação visual em tela/3D real (apenas os testes de geometria e desenho).
- A seção/elevação usa o estado fechado, como o restante do módulo; o tracejado das peças ocultas foi
  acrescentado, mas não há hachura específica nova para `pocket`/`track`.
