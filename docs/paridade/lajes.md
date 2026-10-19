# Paridade · Lajes

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (telhados).
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Floor estrutural; ArchiCAD: Slab). Decisões em [docs/decisoes/0007](../decisoes/0007-lajes.md).

## A · Geometria
- [ ] A1 Contorno fechado por cliques, retângulo e medida digitada, com captura nas faces das paredes **(bloqueante)**
- [ ] A2 Contorno automático pelo perímetro externo das paredes do nível (face externa) e por área fechada **(bloqueante)**
- [ ] A3 Furos (shaft, escada) **(bloqueante)**
- [ ] A4 Edição do contorno por alças (mover, inserir e remover vértice)
- [ ] A5 Inclinação da face superior por linha e percentual (caimento) **(bloqueante)**
- [ ] A6 Inclinação por dois pontos com cotas
- [-] A7 Laje com contorno curvo: junto com piso curvo, depende de arcos em polígonos
- [-] A8 Laje nervurada e com vigas integradas: fase de estrutura

## B · Camadas e tipos
- [ ] B1 Tipo de laje com camadas (função, material, espessura, membrana de espessura zero) **(bloqueante)**
- [ ] B2 Editor de tipo de laje com seção ao vivo **(bloqueante)**
- [ ] B3 Deslocamento do topo em relação ao nível, na instância
- [ ] B4 Duplicar, renomear, substituir e excluir tipo (bloqueado se em uso)

## C · Relação com paredes e pisos
- [ ] C1 Parede anexada ao topo ou base da laje do nível, com a inclinação considerada **(bloqueante)**
- [ ] C2 Laje e piso sobrepostos no mesmo nível detectados, com aviso
- [ ] C3 Lajes sobrepostas detectadas, com aviso

## D · Vistas
- [ ] D1 Planta: laje vista de cima com hachura do material estrutural, atrás das paredes; laje do nível abaixo como subpavimento **(bloqueante)**
- [ ] D2 3D com inclinação e furos **(bloqueante)**
- [ ] D3 Corte e elevação com inclinação e hachura por camada **(bloqueante)**
- [ ] D4 Nível de detalhe em planta

## E · Quantitativos
- [ ] E1 Área, volume por camada e por material, considerando a inclinação **(bloqueante)**
- [ ] E2 Tabela de lajes com colunas, filtros, totais e CSV
- [ ] E3 Etiqueta de laje na planta
- [ ] E4 Exportação DXF

## F · Edição
- [ ] F1 Selecionar, mover, copiar, girar, espelhar, matriz **(bloqueante)**
- [ ] F2 Colar alinhado entre níveis inclui lajes
- [ ] F3 Selecionar todas do mesmo tipo
- [ ] F4 Ferramenta Laje no Ribbon, atalho e barra de opções

## G · Qualidade
- [ ] G1 Validação: contorno com menos de 3 pontos, que se cruza, de área zero, tipo ausente, furo fora, inclinação inválida **(bloqueante)**
- [ ] G2 Painel de avisos com "Ir para"
- [ ] G3 Casos dourados de área e volume, com e sem inclinação **(bloqueante)**
- [ ] G4 Testes de propriedade (sem exceção, volume = área × espessura média)
- [ ] G5 Migração de arquivo v7 e ida e volta
- [ ] G6 Regressão visual por captura
