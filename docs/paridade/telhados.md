# Paridade · Telhados

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (escadas).
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Roof by Footprint; ArchiCAD: Roof). Decisões em [docs/decisoes/0008](../decisoes/0008-telhados.md).

## A · Geometria
- [ ] A1 Contorno do beiral por cliques, retângulo e medida digitada, com captura nas faces **(bloqueante)**
- [ ] A2 Contorno pelas paredes: perímetro externo mais balanço de beiral **(bloqueante)**
- [ ] A3 Formas: uma água, duas águas e quatro águas, com inclinação em % ou graus **(bloqueante)**
- [ ] A4 Direção da cumeeira (duas águas) e do caimento (uma água) editáveis **(bloqueante)**
- [ ] A5 Águas livres: polígono, direção e inclinação de cada água
- [ ] A6 Cumeeira, espigões e rincões calculados pelo encontro das águas **(bloqueante)**
- [ ] A7 Furos (claraboia, shaft)
- [ ] A8 Edição do contorno por alças e do beiral
- [-] A9 Telhado por extrusão de perfil (curvo, mansarda): v2
- [-] A10 Contorno não convexo com quatro águas automáticas: usar águas livres; esqueleto reto completo no v2

## B · Camadas e tipos
- [ ] B1 Tipo de telhado com camadas (telha, ripa, estrutura), espessura vertical **(bloqueante)**
- [ ] B2 Editor de tipo com seção ao vivo **(bloqueante)**
- [ ] B3 Cota do beiral (nível + deslocamento) na instância
- [ ] B4 Duplicar, renomear, substituir e excluir tipo

## C · Relação com paredes
- [ ] C1 Topo da parede se ajusta ao telhado (empenas e frontões) **(bloqueante)**
- [ ] C2 Aviso de parede que ultrapassa o telhado ou fica fora dele
- [ ] C3 Telhados sobrepostos detectados, com aviso

## D · Vistas
- [ ] D1 Planta: águas, cumeeira, espigões, rincões e setas de caimento com percentual **(bloqueante)**
- [ ] D2 3D com as águas, frontões e beiral **(bloqueante)**
- [ ] D3 Corte e elevação com inclinação **(bloqueante)**
- [ ] D4 Subpavimento: telhado do nível abaixo apagado
- [ ] D5 Nível de detalhe em planta

## E · Quantitativos
- [ ] E1 Área real das águas, volume por camada, comprimentos de cumeeira, espigão, rincão e beiral **(bloqueante)**
- [ ] E2 Tabela de telhados com filtros, totais e CSV
- [ ] E3 Etiqueta de telhado na planta
- [ ] E4 Exportação DXF

## F · Edição
- [ ] F1 Selecionar, mover, copiar, girar, espelhar **(bloqueante)**
- [ ] F2 Colar alinhado entre níveis inclui telhados
- [ ] F3 Selecionar todos do mesmo tipo
- [ ] F4 Ferramenta Telhado no Ribbon, atalho e barra de opções
- [ ] F5 Troca de nível de parede, piso, laje e telhado em Propriedades, mantendo a cota ou levando o deslocamento **(bloqueante)**
- [ ] F6 Nível base e nível superior editáveis na parede; "Mover para o nível…" para qualquer elemento

## G · Qualidade
- [ ] G1 Validação: contorno inválido, inclinação inválida, água degenerada, contorno não convexo em quatro águas, tipo ausente **(bloqueante)**
- [ ] G2 Painel de avisos com "Ir para"
- [ ] G3 Casos dourados de áreas, volumes, cumeeira e alturas **(bloqueante)**
- [ ] G4 Testes de propriedade (contornos convexos aleatórios: altura contínua entre águas, sem exceção)
- [ ] G5 Migração de arquivo v8 e ida e volta
- [ ] G6 Regressão visual por captura
