# Paridade · Lajes

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (telhados).
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Floor estrutural; ArchiCAD: Slab). Decisões em [docs/decisoes/0007](../decisoes/0007-lajes.md).

## A · Geometria
- [x] A1 Contorno fechado por cliques, retângulo e medida digitada, com captura nas faces das paredes **(bloqueante)**
- [x] A2 Contorno automático pelo perímetro externo das paredes do nível (face externa) e por área fechada **(bloqueante)**
- [x] A3 Furos (shaft, escada) **(bloqueante)**
- [x] A4 Edição do contorno por alças (mover, inserir e remover vértice)
- [x] A5 Inclinação da face superior por linha e percentual (caimento) **(bloqueante)**
- [-] A6 Inclinação por dois pontos com cotas: a linha de origem e direção com percentual (A5) cobre o caimento; cota por ponto entra com os telhados
- [-] A7 Laje com contorno curvo: junto com piso curvo, depende de arcos em polígonos
- [-] A8 Laje nervurada e com vigas integradas: fase de estrutura

## B · Camadas e tipos
- [x] B1 Tipo de laje com camadas (função, material, espessura, membrana de espessura zero) **(bloqueante)**
- [x] B2 Editor de tipo de laje com seção ao vivo **(bloqueante)**
- [x] B3 Deslocamento do topo em relação ao nível, na instância
- [x] B4 Duplicar, renomear, substituir e excluir tipo (bloqueado se em uso)

## C · Relação com paredes e pisos
- [x] C1 Parede anexada ao topo ou base da laje do nível, com a inclinação considerada **(bloqueante)**
- [x] C2 Laje e piso sobrepostos no mesmo nível detectados, com aviso
- [x] C3 Lajes sobrepostas detectadas, com aviso
- [x] C4 Contorno associativo (motor): laje pelo perímetro externo guarda a origem e o contorno é derivado no motor — acompanha as paredes (decisão 0023 §8.2)
- [x] C5 Vínculo do contorno na interface (P2 e P3): grupo "Contorno" com estado, "Desvincular" e "Revincular às paredes" (um passo de desfazer); aviso `contorno-aberto` com "Ir para"; barra de status ao soltar por edição de vértice. Evidência: `packages/engine/src/outlineIssues.test.ts`, `apps/web/src/ui/OutlineGroup.test.ts`, `packages/tools/src/outlineEdit.test.ts`, e2e `tests/e2e/contorno.mjs` (piso; laje segue o mesmo grupo e o mesmo aviso)
- [x] C6 Piso sobre a laje com camada estrutural avisa `piso-estrutura-sobre-laje` (decisão 0023 P5); o acabamento usa `ft_acab`
- [x] C7 Laje × parede e laje × piso por prioridade de camada nos quantitativos (0023 §1, P7); testes em `netQuantities.test.ts`
- [x] C9 Contorno por camada com término na junção (0023 §2, P8 e F6): mesmo critério do piso (C7 de pisos), para lajes vinculadas às paredes sem caimento e no perímetro externo. Evidência: `packages/engine/src/layerOutline.test.ts`, `layerOutlineSection.test.ts`, `packages/model/src/termino.test.ts`, `apps/web/src/ui/dialogs/terminoForm.test.ts`. Fora: laje com caimento; no perímetro o `auto` fica na face de acabamento (item 14 de 0023 §6.2)
- [x] C8 Laje × parede e laje × piso por prioridade na planta, no corte e no 3D (0023 P7, P7b, P7c, F1b, F3, F4). Laje e piso desenham a região resolvida e a parede é recortada pela laje na mesma junção, inclusive a do pavimento de cima que atravessa o nível (F1b); quantitativos e desenho coincidem (`desenhoQuantitativo`). Lajes com caimento seguem de fora da junção (pendência em 0023 §6.2, item 11). Evidência: `junctionCrossLevel`, `junctionMatriz`, `junctionWall`, `wallJunction`, `wallJunctionSolids`, `junctionSection`, `sectionCota`, e2e `parede-recorte.mjs` e regressões `junc-corte-parede-embutida-piso`, `junc-parede-recortada-laje` e `junc-fachada-continua-laje`. Fora: DXF e IFC por camada.
- [x] C12 Limite da camada no perímetro externo (0027): campo `limiteExterno` (`parede` = até a face externa da parede; `nucleo` = sob o acabamento externo, até a face externa do núcleo) corta só a camada escolhida na borda da edificação, independente do término nas paredes internas; é o que faz o acabamento externo da parede ficar contínuo por fora da laje. Evidência: `packages/engine/src/limiteExterno.test.ts`, `packages/model/src/termino.test.ts`, `apps/web/src/ui/dialogs/terminoForm.test.ts`.
- [x] C11 Término nas paredes por camada na laje única (0025, P10): mesmas regras de pisos (C11); a laje também recorta pelas paredes do nível de cima e de baixo (teto entre pavimentos). Tipo `ls_unica` no catálogo. Evidência: `packages/engine/src/terminoLaje.test.ts`, `terminoPiso.test.ts` (regras), `packages/model/src/termino.test.ts`. Fora: laje com caimento e DXF e IFC por camada.
- [x] C10 Parede anexada à base ou ao topo da laje por trecho (0023 P9): só o trecho coberto pela laje recebe a cota, com degrau na borda do contorno; laje inclinada pela cota no ponto médio do trecho; topo na face inferior da laje do nível de topo, também por trecho. Evidência: `packages/engine/src/wallFloorProfile.test.ts`, `wallFloorIssues.test.ts`, `packages/render/src/model3d/wallFloorSolids.test.ts`. Fora: o IFC como caixa.

## D · Vistas
- [x] D1 Planta: laje vista de cima com hachura do material estrutural, atrás das paredes; laje do nível abaixo como subpavimento **(bloqueante)**
- [x] D2 3D com inclinação e furos **(bloqueante)**
- [x] D3 Corte e elevação com inclinação e hachura por camada **(bloqueante)**
- [x] D4 Nível de detalhe em planta

## E · Quantitativos
- [x] E1 Área, volume por camada e por material, considerando a inclinação **(bloqueante)**
- [x] E2 Tabela de lajes com colunas, filtros, totais e CSV
- [x] E3 Etiqueta de laje na planta
- [x] E4 Exportação DXF
- [x] E5 Quantitativo líquido: a laje não perde volume para piso ou parede; pisos que ela corta perdem a interseção (decisão 0023 §4, P5)

## F · Edição
- [x] F1 Selecionar, mover, copiar, girar, espelhar, matriz **(bloqueante)**
- [x] F2 Colar alinhado entre níveis inclui lajes
- [x] F3 Selecionar todas do mesmo tipo
- [x] F4 Ferramenta Laje no Ribbon, atalho e barra de opções

## G · Qualidade
- [x] G1 Validação: contorno com menos de 3 pontos, que se cruza, de área zero, tipo ausente, furo fora, inclinação inválida **(bloqueante)**
- [x] G2 Painel de avisos com "Ir para"
- [x] G3 Casos dourados de área e volume, com e sem inclinação **(bloqueante)**
- [x] G4 Testes de propriedade (sem exceção, volume = área × espessura média)
- [x] G5 Migração de arquivo v7 e ida e volta
- [x] G6 Regressão visual por captura
- [x] G7 Membrana de espessura zero: linha na planta e no corte, área de face e volume zero, sem sólido no 3D (decisão 0023 P4)
