# Paridade · Telhados

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (escadas).
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Roof by Footprint; ArchiCAD: Roof). Decisões em [docs/decisoes/0008](../decisoes/0008-telhados.md).

## A · Geometria
- [x] A1 Contorno do beiral por cliques, retângulo e medida digitada, com captura nas faces **(bloqueante)**
- [x] A2 Contorno pelas paredes: perímetro externo mais balanço de beiral **(bloqueante)**
- [x] A3 Formas: uma água, duas águas e quatro águas, com inclinação em % ou graus **(bloqueante)**
- [x] A4 Direção da cumeeira (duas águas) e do caimento (uma água) editáveis **(bloqueante)**
- [-] A5 Seta de inclinação e águas livres editadas na tela: fora de escopo da v1 por decisão do dono (2026-10-21). Ficam a ferramenta de seta e a lista de águas; o polígono próprio de cada água não entra na v1
- [x] A6 Cumeeira, espigões e rincões calculados pelo encontro das águas **(bloqueante)**
- [x] A7 Furos (claraboia, shaft)
- [x] A8 Edição do contorno por alças e do beiral
- [x] A9 Telhado por extrusão de perfil (arco, mansarda, dente de serra) **(bloqueante)**
- [x] A10 Contorno qualquer (L, T, U, com furos) com inclinação por aresta (Define Slope) e empena por aresta sem inclinação, esqueleto reto com pesos **(bloqueante)**
- [x] A11 Edição por aresta na planta: ligar/desligar "define inclinação", inclinação e balanço por aresta, vértices **(bloqueante)**
- [x] A12 A ferramenta nunca some: contorno inválido mostra o motivo e não cria **(bloqueante)**

## B · Camadas e tipos
- [x] B1 Tipo de telhado com camadas (telha, ripa, estrutura), espessura vertical **(bloqueante)**
- [x] B2 Editor de tipo com seção ao vivo **(bloqueante)**
- [x] B3 Cota do beiral (nível + deslocamento) na instância
- [x] B4 Duplicar, renomear, substituir e excluir tipo

## C · Relação com paredes
- [x] C1 Topo da parede se ajusta ao telhado (empenas e frontões) **(bloqueante)**
- [x] C2 Aviso de parede que ultrapassa o telhado ou fica fora dele; topo ajustado só no trecho coberto **(bloqueante)** Parede curva fica na altura normal e recebe o mesmo aviso (face inferior amostrada ao longo do arco, passo ≤ 0,25 m).
- [x] C4 Junção de telhados (Join Roof) e abertura/claraboia no telhado **(bloqueante)**
- [x] C5 Acabamentos do beiral: testeira, calha, forro, e corte de caibro prumo/esquadro (corte de caibro no corte; no 3D as camadas continuam cortadas na vertical)
- [x] C6 Anexar/desanexar topo da parede ao telhado pelo comando (3D e planta): paredes, depois clique no telhado; a parede guarda o telhado escolhido. No 3D o clique usa o raio contra as malhas, mas o teste só cobre o raio; conferir no navegador
- [x] D6 Cota da cumeeira, etiqueta de inclinação e planta de cobertura
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
- [x] G1 Validação: contorno inválido, inclinação inválida, água degenerada, cumeeira sem aresta paralela (aviso), tipo ausente **(bloqueante)**. Contorno côncavo em quatro águas não tem validação própria: o esqueleto reto o calcula (medidos em decisão 0008, item 3).
- [x] G2 Painel de avisos com "Ir para"
- [x] G3 Casos dourados de áreas, volumes, cumeeira e alturas **(bloqueante)**
- [x] G4 Testes de propriedade (contornos convexos aleatórios: altura contínua entre águas, sem exceção)
- [x] G5 Migração de arquivo v8 e ida e volta
- [x] G6 Regressão visual por captura
