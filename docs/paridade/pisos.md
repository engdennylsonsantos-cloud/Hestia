# Paridade · Pisos

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (lajes).
Fonte do comportamento: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Floor; ArchiCAD: Slab). Decisões em [docs/decisoes/0006](../decisoes/0006-pisos.md).

## A · Geometria
- [ ] A1 Contorno fechado por cliques, com medida digitada e captura (inferência) **(bloqueante)**
- [ ] A2 Contorno por retângulo (dois cantos) **(bloqueante)**
- [ ] A3 Contorno por seleção de paredes ou clique numa área fechada pelas paredes (face interna) **(bloqueante)**
- [ ] A4 Furos (aberturas) dentro do piso, desenhados como contorno interno **(bloqueante)**
- [ ] A5 Edição do contorno: alças nos vértices, arrastar aresta, adicionar e remover vértice
- [ ] A6 Piso curvo (contorno com arcos)
- [-] A7 Piso inclinado (seta de inclinação ou pontos): depende de cota por ponto no modelo; entra no checklist de lajes e telhados
- [-] A8 Direção do vão da estrutura: só tem efeito no cálculo estrutural, fora do escopo da v1

## B · Camadas e tipos
- [ ] B1 Tipo de piso com camadas (função, material, espessura), núcleo e espessura total **(bloqueante)**
- [ ] B2 Editor de tipo de piso com seção ao vivo, no mesmo padrão do tipo de parede **(bloqueante)**
- [ ] B3 Deslocamento de altura do topo em relação ao nível, na instância
- [ ] B4 Duplicar, renomear, substituir e excluir tipo (bloqueado se em uso)
- [-] B5 Camada de espessura variável (caimento): fora, depende de A7

## C · Relação com paredes
- [ ] C1 Parede cortada ou terminada pelo piso do nível (base/topo anexados ao piso) **(bloqueante)**
- [ ] C2 Piso respeita a face interna das paredes ao ser criado por paredes
- [ ] C3 Pisos sobrepostos no mesmo nível detectados, com aviso
- [-] C4 Junção de geometria entre pisos adjacentes (une camadas iguais): reavaliar com lajes

## D · Vistas
- [ ] D1 Planta: preenchimento e hachura do material da camada de topo, atrás das paredes **(bloqueante)**
- [ ] D2 3D: sólido por camada, com furos **(bloqueante)**
- [ ] D3 Corte e elevação: piso cortado com hachura por camada **(bloqueante)**
- [ ] D4 Subpavimento: piso do nível abaixo como referência apagada
- [ ] D5 Nível de detalhe grosseiro, médio e fino também no piso

## E · Quantitativos e documentação
- [ ] E1 Área e volume por camada e por material **(bloqueante)**
- [ ] E2 Tabela de pisos com colunas, filtros, totais e CSV
- [ ] E3 Etiqueta de piso na planta (código do tipo e área)
- [ ] E4 Exportação DXF do contorno do piso
- [-] E5 IFC: fase de interoperabilidade

## F · Edição
- [ ] F1 Selecionar (clique, janela), mover, copiar, girar, espelhar, matriz **(bloqueante)**
- [ ] F2 Colar alinhado entre níveis inclui pisos
- [ ] F3 Selecionar todos do mesmo tipo
- [ ] F4 Dividir piso por uma linha
- [ ] F5 Ferramenta Piso no Ribbon, atalho e barra de opções (tipo, deslocamento, modo)

## G · Qualidade
- [ ] G1 Validação: contorno com menos de 3 pontos, que se cruza, de área zero, tipo ausente, furo fora do contorno **(bloqueante)**
- [ ] G2 Painel de avisos mostra os problemas de piso com "Ir para"
- [ ] G3 Casos dourados de área e volume (retângulo, L, com furo, por paredes) **(bloqueante)**
- [ ] G4 Testes de propriedade com contornos aleatórios (sem exceção, área = contorno − furos)
- [ ] G5 Migração de arquivo antigo (v6 sem pisos) e ida e volta de arquivo
- [ ] G6 Regressão visual por captura de tela
