# Paridade · Aberturas (portas e janelas)

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (ambientes).
Fonte: [docs/aberturas](../aberturas/) (Revit 2024: Door/Window Type Properties; ArchiCAD 26: Door/Window Settings;
IFC `Operation`). Decisões em [docs/decisoes/0017](../decisoes/0017-portas-e-janelas.md).

## Planta (símbolo)
- [x] P1 Porta de giro, 1 folha: folha de comprimento W na dobradiça e arco de 90° de raio W até a ombreira oposta **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`
- [x] P2 Porta dupla: duas folhas de W/2, dobradiças nas ombreiras e dois arcos de 90° até o centro **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`
- [-] P3 Porta pivotante: **mantida por decisão do dono** (não é família de sistema no Revit). O símbolo foi corrigido nesta rodada — eixo a W/4 de uma ombreira, folha de comprimento W e dois arcos até as duas ombreiras — mas a convenção exata do eixo segue provisória, sem fonte oficial (`A-pesquisa.md` §6) — `packages/geom/src/openingSymbol.test.ts`
- [x] P4 Porta de correr: dois retângulos fechados em faces opostas, com sobreposição no meio e seta **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`, `packages/render/src/plan/symbols.test.ts`
- [x] P5 Janela de correr: n folhas em linhas defasadas (2 ou 3), sem linha no plano médio, com seta **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`
- [x] P6 Janela fixa: duas linhas de face, linha do plano médio e duas ombreiras **(bloqueante)** — `packages/render/src/plan/symbols.test.ts`
- [x] P7 Maxim-ar (arco tracejado do lado de `flipFacing`) e basculante (V no plano médio) **(bloqueante)** — `packages/render/src/plan/symbols.test.ts`
- [x] P8 Vão livre (0 folhas): só a soleira tracejada no plano médio, de −W/2 a +W/2 **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`, `packages/render/src/plan/symbols.test.ts`
- [x] P9 Famílias com efeito: cada família desenha diferente; `double` passou a ter sentido próprio (2 folhas) e é normalizado para `swing` com 2 folhas; combinação fora das famílias é recusada **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`, `packages/render/src/plan/symbols.test.ts`, `packages/model/src/opening.test.ts`
- [x] P10 Janela com 0 folhas: planta e 3D concordam — só a soleira, sem caixilho nem vidro **(bloqueante)** — `packages/geom/src/openingSymbol.test.ts`, `packages/render/src/model3d/scene3d.test.ts`

## Corte e elevação
- [x] C1 Batente no corte e na elevação: ombreiras, verga e soleira com a espessura do perfil (`frameWidth`) do tipo; no corte transversal, com a profundidade do batente (`frameDepth`), centradas na parede **(bloqueante)** — `packages/render/src/section/build.test.ts`
- [x] C2 Vidro: região interna do caixilho na vista face; faixa com a espessura do tipo (`glassThickness`) no corte transversal **(bloqueante)** — `packages/render/src/section/build.test.ts`
- [-] C3 Peitoril com saliência: o `OpeningType` não tem campo de saliência (`sill.projection`); sem o campo, o critério vale como "sem saliência, nenhuma peça extra" (peitoril saliente e pingadeira ficam para a frente de acabamentos)
- [-] C4 Verga e contraverga: fora desta entrega; a altura e o transpasse são divergentes nas fontes (`A-pesquisa.md` §2.3 e §6) e dependem do projeto estrutural
- [x] C5 Porta em corte: o vão de porta sem folha não tem preenchimento e a porta com folha aparece preenchida (folha fechada, só a parte visível pela linha oculta) **(bloqueante)** — `packages/render/src/section/build.test.ts`
- [x] C6 Linha central da janela: só na janela de correr (2 ou 3 folhas); a fixa, a basculante e a maxim-ar não a têm **(bloqueante)** — `packages/render/src/section/build.test.ts`

## Elevação
- [x] E1 Símbolo de abertura na elevação: arco tracejado do maxim-ar/basculante dentro do vão, do lado de `flipFacing`, e traço tracejado do lado da dobradiça na porta de giro — `packages/render/src/section/build.test.ts`
- [x] E2 Folha de correr na elevação com a seta de correr (janela e porta) — `packages/render/src/section/build.test.ts`

## 3D
- [x] D1 Batente (ombreiras e verga) com a largura do tipo (`frameWidth`), não 0,05 fixo **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D2 Folha de porta com a espessura do tipo (`leafThickness`) **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D3 Porta dupla: dois painéis de (W − 2·batente)/2, centros em ±1/4 do vão livre **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D4 Janela com folhas: montantes entre as folhas com a largura da folha do tipo (n folhas → n−1 montantes) **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D5 Vidro com a espessura do tipo (`glassThickness`); janela de correr com n folhas em trilhos defasados na profundidade **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D6 Porta fechada (folha no vão); sem modo aberto nesta entrega **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D7 Vão livre de porta (0 folhas): sem peça no 3D **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`
- [x] D8 Janela com 0 folhas: só a soleira no 3D, igual à planta **(bloqueante)** — `packages/render/src/model3d/scene3d.test.ts`

## DXF
- [x] X1 Vão de corte no DXF com o símbolo de planta (mesma função `openingSymbolPaths` da tela), na camada `ABERTURAS`; sem símbolo, continua retângulo fechado (compatibilidade) **(bloqueante)** — `packages/io/src/dxf.test.ts`, `apps/web/src/editor/dxfExport.test.ts`
- [x] X2 Projeção (acima/abaixo/além) com o símbolo nas camadas `ABERTURA_ACIMA`/`ABERTURA_ABAIXO`/`ABERTURA_ALEM` — `packages/io/src/dxf.test.ts`, `apps/web/src/editor/dxfExport.test.ts`

## Quantitativo
- [x] Q1 Área de vão descontada da parede não muda com a aparência; a área unitária/total da tabela é largura × altura **(bloqueante)** — `packages/engine/src/quantities.ts`, `packages/engine/src/openingSchedule.test.ts`

## Tabela e testes
- [x] T1 Os testes de símbolo conferem pontos (fim de cada arco na ombreira, comprimento de cada folha, raio de cada arco), não só a contagem de traços — `packages/geom/src/openingSymbol.test.ts`
- [x] T2 Quadro (tabela de portas e janelas): uma linha por tipo usado, com código (Type Mark), família, dimensões, folhas, quantidade, área e CSV — `packages/engine/src/openingSchedule.test.ts`
