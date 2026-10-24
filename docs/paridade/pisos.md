# Paridade · Pisos

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (lajes).
Fonte do comportamento: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Floor; ArchiCAD: Slab). Decisões em [docs/decisoes/0006](../decisoes/0006-pisos.md).

## A · Geometria
- [x] A1 Contorno fechado por cliques, com medida digitada e captura (inferência) **(bloqueante)**
- [x] A2 Contorno por retângulo (dois cantos) **(bloqueante)**
- [x] A3 Contorno por seleção de paredes ou clique numa área fechada pelas paredes (face interna) **(bloqueante)**
- [x] A4 Furos (aberturas) dentro do piso, desenhados como contorno interno **(bloqueante)**
- [x] A5 Edição do contorno: alças nos vértices, arrastar aresta, adicionar e remover vértice
- [-] A6 Piso curvo (contorno com arcos): o contorno é poligonal; arcos entram junto com as lajes (mesma geometria), reavaliar lá
- [-] A7 Piso inclinado (seta de inclinação ou pontos): depende de cota por ponto no modelo; entra no checklist de lajes e telhados
- [-] A8 Direção do vão da estrutura: só tem efeito no cálculo estrutural, fora do escopo da v1

## B · Camadas e tipos
- [x] B1 Tipo de piso com camadas (função, material, espessura), núcleo e espessura total **(bloqueante)**
- [x] B2 Editor de tipo de piso com seção ao vivo (a espessura total vale; o piso não tem conceito de núcleo) **(bloqueante)**
- [x] B3 Deslocamento de altura do topo em relação ao nível, na instância
- [x] B4 Duplicar, renomear, substituir e excluir tipo (bloqueado se em uso)
- [-] B5 Camada de espessura variável (caimento): fora, depende de A7
- [x] B6 Tipo de acabamento sobre laje `ft_acab` (sem camada estrutural), padrão para pisos sobre laje; `ft_ceram` mantido (decisão 0023 P5)

## C · Relação com paredes
- [x] C1 Parede cortada ou terminada pelo piso do nível (base/topo anexados ao piso) **(bloqueante)**
- [x] C2 Piso respeita a face interna das paredes ao ser criado por paredes
- [x] C3 Pisos sobrepostos no mesmo nível detectados, com aviso
- [-] C4 Junção de geometria entre pisos adjacentes (une camadas iguais): reavaliar com lajes
- [x] C5 Junção piso × parede por prioridade de camada nos quantitativos (0023 §1, P7): núcleo, prioridade efetiva e empate por tipo; testes em `junctionPlanar.test.ts` e `netQuantities.test.ts`
- [x] C7 Contorno por camada com término na junção (0023 §2, P8 e F6): cada camada de piso vinculado às paredes tem o próprio contorno (`auto`, `nucleo`, `face`, `passa`, `até prioridade N` ou deslocamento em cm), e o perímetro externo segue o mesmo critério (face de acabamento e face do núcleo). Quantitativos, corte e 3D usam o contorno da camada. Campo na seção avançada da camada. No perímetro o `auto` fica na face de acabamento, por compatibilidade (item 14 de 0023 §6.2). Evidência: `packages/engine/src/layerOutline.test.ts`, `layerOutlineSection.test.ts`, `packages/render/src/model3d/layerOutlineSolids.test.ts`, `packages/model/src/termino.test.ts`, `apps/web/src/ui/dialogs/terminoForm.test.ts`, regressão `junc-piso-retangulo-*`
- [x] C6 Junção piso × parede na planta, no corte e no 3D (0023 P7, P7b, P7c, F1b, F3, F4). Piso desenha a região resolvida; a parede é recortada pela camada que vence no corte e no 3D; a laje do pavimento de cima corta a parede que ela atravessa (F1b). Planta sem recorte na altura de corte padrão (F2, decisão de escopo). Testes: `junctionMatriz` (18 combinações piso × parede em L e T), `junctionWall`, `junctionCrossLevel`, `wallJunctionSolids`, `desenhoQuantitativo`, regressão `junc-corte-parede-embutida-piso`.
- [x] C5 Contorno associativo (motor): piso criado por paredes/perímetro guarda a origem e o contorno é derivado no motor — acompanha mover/espessura/tipo de parede (porta/janela não alteram); circuito aberto mantém o último contorno (decisão 0023 §8.2)
- [x] C6 Vínculo do contorno na interface (P2 e P3): grupo "Contorno" com estado, "Desvincular" e "Revincular às paredes" (um passo de desfazer; sem origem fica "Sem vínculo (desenhado por croqui)"); avisos `contorno-aberto` e `piso-circuito-duplicado` com "Ir para"; barra de status ao soltar por edição de vértice. Evidência: `packages/engine/src/outlineIssues.test.ts`, `packages/engine/src/outlineBound.test.ts` (mover, espessura, porta, apagar parede, dois pisos, cache de 200 paredes), `apps/web/src/ui/OutlineGroup.test.ts`, `apps/web/src/editor/issuesView.test.ts`, `packages/tools/src/outlineEdit.test.ts`, e2e `tests/e2e/contorno.mjs`
- [x] C12 Limite da camada no perímetro externo (0027): campo `limiteExterno` (`parede` = até a face externa da parede; `nucleo` = sob o acabamento externo, até a face externa do núcleo) corta só a camada escolhida na borda da edificação, independente do término nas paredes internas; seletor "Limite no perímetro" na seção avançada da camada. Evidência: `packages/engine/src/limiteExterno.test.ts`, `packages/model/src/termino.test.ts`, `apps/web/src/ui/dialogs/terminoForm.test.ts`.
- [x] C11 Término nas paredes por camada (0025, P10): regras `face`, `nucleo`, `passa` e `até a prioridade ≤ N` recortam o piso pelas paredes do nível que tocam a sua faixa de cota (multipolígono com furos); vãos de porta que chegam ao piso ficam no acabamento; tipo `ft_unico` (piso único) no catálogo; planta (preenchimento da camada de topo), corte, 3D e quantitativos por camada; seletor "Término nas paredes" com a prioridade e o deslocamento. Evidência: `packages/engine/src/terminoPiso.test.ts`, `terminoPisoSection.test.ts`, `packages/render/src/model3d/pisoUnicoSolids.test.ts`, `packages/render/src/plan/pisoUnicoFill.test.ts`, `packages/model/src/termino.test.ts`, `apps/web/src/ui/dialogs/terminoForm.test.ts`, `tests/e2e/piso-unico.mjs`, casos `piso-unico-parede-face` e `piso-unico-parede-nucleo`. Fora: DXF e IFC por camada, cor por camada na planta.
- [x] C8 Parede anexada à base ou ao topo por trecho (0023 P9): só o trecho coberto pelo piso recebe a cota, com degrau na borda do contorno; laje inclinada pela cota no ponto médio do trecho; avisos `wall-floor-partial` (informativo) e `wall-attach-none`. Evidência: `packages/engine/src/wallFloorProfile.test.ts`, `wallFloorIssues.test.ts`, `wallFloorSection.test.ts`, `packages/render/src/model3d/wallFloorSolids.test.ts`. Fora: o IFC como caixa.

## D · Vistas
- [x] D1 Planta: preenchimento e hachura do material da camada de topo, atrás das paredes **(bloqueante)**
- [x] D2 3D: sólido por camada, com furos **(bloqueante)**
- [x] D3 Corte e elevação: piso cortado com hachura por camada **(bloqueante)**
- [x] D4 Subpavimento: piso do nível abaixo como referência apagada
- [x] D5 Nível de detalhe grosseiro, médio e fino também no piso
- [x] D6 Cotas automáticas da planta (0028): botão **Cotas auto** no grupo **Anotar** grava no nível ativo as camadas aberturas → paredes → total nos quatro lados, com referência associativa nas pontas de parede; as cotas convivem com o piso na mesma planta. Evidência: `packages/engine/src/autoCotas.test.ts`, regressão `cotas-automaticas`

## E · Quantitativos e documentação
- [x] E1 Área e volume por camada e por material **(bloqueante)**
- [x] E2 Tabela de pisos com colunas, filtros, totais e CSV
- [x] E3 Etiqueta de piso na planta (código do tipo e área)
- [x] E4 Exportação DXF do contorno do piso
- [-] E5 IFC: fase de interoperabilidade
- [x] E6 Quantitativos líquidos: piso perde o volume que a laje do nível ocupa; parede perde o que piso ocupa; tabela mostra bruto e líquido quando diferem (decisão 0023 §4, P5)

## F · Edição
- [x] F1 Selecionar (clique, janela), mover, copiar, girar, espelhar, matriz **(bloqueante)**
- [x] F2 Colar alinhado entre níveis inclui pisos
- [x] F3 Selecionar todos do mesmo tipo
- [x] F4 Dividir piso por uma linha: gera dois pisos do mesmo tipo (decisão 0031 §2); furos seguem a parte que contém o seu centro, furo cortado pela linha é descartado; contorno vinculado às paredes fica travado até Desvincular. Evidência: `packages/tools/src/splitEdge.test.ts`, `splitRing.test.ts`
- [x] F5 Ferramenta Piso no Ribbon, atalho e barra de opções (tipo, deslocamento, modo)

## G · Qualidade
- [x] G1 Validação: contorno com menos de 3 pontos, que se cruza, de área zero, tipo ausente, furo fora do contorno **(bloqueante)**
- [x] G2 Painel de avisos mostra os problemas de piso com "Ir para"
- [x] G3 Casos dourados de área e volume (retângulo, L, com furo, por paredes) **(bloqueante)**
- [x] G4 Testes de propriedade com contornos aleatórios (sem exceção, área = contorno − furos)
- [x] G5 Migração de arquivo antigo (v6 sem pisos) e ida e volta de arquivo
- [x] G6 Regressão visual por captura de tela
- [x] G7 Membrana de espessura zero: linha na planta e no corte, área de face e volume zero, sem sólido no 3D (decisão 0023 P4)
- [x] G8 Aviso `piso-estrutura-sobre-laje`: piso com camada estrutural sobre a laje do nível (concreto contado duas vezes) (decisão 0023 P5)
