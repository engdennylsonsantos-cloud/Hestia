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
- [ ] C5 Vínculo do contorno na interface: aviso "Contorno solto das paredes", botão "Revincular" e aviso de circuito aberto (fase P2)

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
