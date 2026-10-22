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

## C · Relação com paredes
- [x] C1 Parede cortada ou terminada pelo piso do nível (base/topo anexados ao piso) **(bloqueante)**
- [x] C2 Piso respeita a face interna das paredes ao ser criado por paredes
- [x] C3 Pisos sobrepostos no mesmo nível detectados, com aviso
- [-] C4 Junção de geometria entre pisos adjacentes (une camadas iguais): reavaliar com lajes
- [x] C5 Contorno associativo (motor): piso criado por paredes/perímetro guarda a origem e o contorno é derivado no motor — acompanha mover/espessura/tipo de parede (porta/janela não alteram); circuito aberto mantém o último contorno (decisão 0023 §8.2)
- [x] C6 Vínculo do contorno na interface (P2 e P3): grupo "Contorno" com estado, "Desvincular" e "Revincular às paredes" (um passo de desfazer; sem origem fica "Sem vínculo (desenhado por croqui)"); avisos `contorno-aberto` e `piso-circuito-duplicado` com "Ir para"; barra de status ao soltar por edição de vértice. Evidência: `packages/engine/src/outlineIssues.test.ts`, `packages/engine/src/outlineBound.test.ts` (mover, espessura, porta, apagar parede, dois pisos, cache de 200 paredes), `apps/web/src/ui/OutlineGroup.test.ts`, `apps/web/src/editor/issuesView.test.ts`, `packages/tools/src/outlineEdit.test.ts`, e2e `tests/e2e/contorno.mjs`

## D · Vistas
- [x] D1 Planta: preenchimento e hachura do material da camada de topo, atrás das paredes **(bloqueante)**
- [x] D2 3D: sólido por camada, com furos **(bloqueante)**
- [x] D3 Corte e elevação: piso cortado com hachura por camada **(bloqueante)**
- [x] D4 Subpavimento: piso do nível abaixo como referência apagada
- [x] D5 Nível de detalhe grosseiro, médio e fino também no piso

## E · Quantitativos e documentação
- [x] E1 Área e volume por camada e por material **(bloqueante)**
- [x] E2 Tabela de pisos com colunas, filtros, totais e CSV
- [x] E3 Etiqueta de piso na planta (código do tipo e área)
- [x] E4 Exportação DXF do contorno do piso
- [-] E5 IFC: fase de interoperabilidade

## F · Edição
- [x] F1 Selecionar (clique, janela), mover, copiar, girar, espelhar, matriz **(bloqueante)**
- [x] F2 Colar alinhado entre níveis inclui pisos
- [x] F3 Selecionar todos do mesmo tipo
- [-] F4 Dividir piso por uma linha: compartilha a operação de recorte com as lajes; entra no checklist de lajes
- [x] F5 Ferramenta Piso no Ribbon, atalho e barra de opções (tipo, deslocamento, modo)

## G · Qualidade
- [x] G1 Validação: contorno com menos de 3 pontos, que se cruza, de área zero, tipo ausente, furo fora do contorno **(bloqueante)**
- [x] G2 Painel de avisos mostra os problemas de piso com "Ir para"
- [x] G3 Casos dourados de área e volume (retângulo, L, com furo, por paredes) **(bloqueante)**
- [x] G4 Testes de propriedade com contornos aleatórios (sem exceção, área = contorno − furos)
- [x] G5 Migração de arquivo antigo (v6 sem pisos) e ida e volta de arquivo
- [x] G6 Regressão visual por captura de tela
