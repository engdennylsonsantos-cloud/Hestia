# Paridade · Telhados

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (escadas).
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Roof by Footprint; ArchiCAD: Roof). Decisões em [docs/decisoes/0008](../decisoes/0008-telhados.md).

## A · Geometria
- [x] A1 Contorno do beiral por cliques, retângulo e medida digitada, com captura nas faces **(bloqueante)**
- [x] A2 Contorno pelas paredes: perímetro externo mais balanço de beiral **(bloqueante)**
- [x] A3 Formas: uma água, duas águas e quatro águas, com inclinação em % ou graus **(bloqueante)**
- [x] A4 Direção da cumeeira (duas águas) e do caimento (uma água) editáveis **(bloqueante)**
- [-] A5 Águas livres editadas na interface: o motor já resolve a forma "free" (águas com polígono, direção e inclinação); adicionar e arrastar águas na tela entra com a ferramenta de planos de telhado (v2)
- [x] A6 Cumeeira, espigões e rincões calculados pelo encontro das águas **(bloqueante)**
- [x] A7 Furos (claraboia, shaft)
- [x] A8 Edição do contorno por alças e do beiral
- [-] A9 Telhado por extrusão de perfil (curvo, mansarda): v2
- [-] A10 Contorno não convexo com quatro águas automáticas: usar águas livres; esqueleto reto completo no v2

## B · Camadas e tipos
- [x] B1 Tipo de telhado com camadas (telha, ripa, estrutura), espessura vertical **(bloqueante)**
- [x] B2 Editor de tipo com seção ao vivo **(bloqueante)**
- [x] B3 Cota do beiral (nível + deslocamento) na instância
- [x] B4 Duplicar, renomear, substituir e excluir tipo

## C · Relação com paredes
- [x] C1 Topo da parede se ajusta ao telhado (empenas e frontões) **(bloqueante)**
- [ ] C2 Aviso de parede que ultrapassa o telhado ou fica fora dele
- [x] C3 Telhados sobrepostos detectados, com aviso

## D · Vistas
- [x] D1 Planta: águas, cumeeira, espigões, rincões e setas de caimento com percentual **(bloqueante)**
- [x] D2 3D com as águas, frontões e beiral **(bloqueante)**
- [x] D3 Corte e elevação com inclinação **(bloqueante)**
- [x] D4 Subpavimento: telhado do nível abaixo apagado
- [x] D5 Nível de detalhe em planta

## E · Quantitativos
- [x] E1 Área real das águas, volume por camada, comprimentos de cumeeira, espigão, rincão e beiral **(bloqueante)**
- [x] E2 Tabela de telhados com filtros, totais e CSV
- [x] E3 Etiqueta de telhado na planta
- [x] E4 Exportação DXF

## F · Edição
- [x] F1 Selecionar, mover, copiar, girar, espelhar **(bloqueante)**
- [x] F2 Colar alinhado entre níveis inclui telhados
- [x] F3 Selecionar todos do mesmo tipo
- [x] F4 Ferramenta Telhado no Ribbon, atalho e barra de opções
- [x] F5 Troca de nível de parede, piso, laje e telhado em Propriedades, mantendo a cota ou levando o deslocamento **(bloqueante)**
- [x] F6 Nível base e nível superior editáveis na parede; "Mover para o nível…" para qualquer elemento

## G · Qualidade
- [x] G1 Validação: contorno inválido, inclinação inválida, água degenerada, contorno não convexo em quatro águas, tipo ausente **(bloqueante)**
- [x] G2 Painel de avisos com "Ir para"
- [x] G3 Casos dourados de áreas, volumes, cumeeira e alturas **(bloqueante)**
- [x] G4 Testes de propriedade (contornos convexos aleatórios: altura contínua entre águas, sem exceção)
- [x] G5 Migração de arquivo v8 e ida e volta
- [x] G6 Regressão visual por captura
