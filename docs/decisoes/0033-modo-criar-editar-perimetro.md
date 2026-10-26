# 0033 · Modo "Criar/Editar perímetro"

Data: 2026-10-26. Status: **DECIDIDA e implementada.** Código: `apps/web/src/editor/perimeterMode.ts` (sessão, botões),
`packages/tools/src/perimeterTool.ts` (desenho e triângulo), `perimeterCommit*.ts` (gravação), `packages/geom/src/sketchValidate.ts`
(validação).

## 1. Entrada única

Telhado, Piso, Laje e Forro abrem o modo para o próprio alvo (`setTool` chama `begin`). "Editar perímetro", no painel do
elemento, reabre o contorno de um elemento existente. As ferramentas antigas de contorno (contorno por cliques, retângulo,
paredes, ambiente, perímetro externo e furo) não são alcançadas pela faixa: o modo é o único caminho de criação.

## 2. Sessão única e só botões

- Uma sessão por vez. Com o modo aberto, trocar de ferramenta, de vista ou de nível, e começar ou editar outro perímetro, é
  recusado com aviso, e o modo fica.
- Concluir e Cancelar só pelos botões da barra. Enter não conclui (o aviso manda usar o botão). Esc cancela o passo em
  andamento e, sem passo, tira a forma escolhida. Delete não exclui a seleção enquanto o modo está aberto.
- Concluir grava num só passo de desfazer ("Criar perímetro" ou "Editar perímetro") e seleciona o elemento.

## 3. Furos são laços internos do esboço

Não há modo de furo. Um laço dentro do externo vira furo do elemento (`role: 'hole'` em `SketchLoop`). Contorno e furos se
desenham com as mesmas linhas, e o externo é o maior laço.

## 4. Regras de validação

Concluir só habilita com o resultado `ok`: ao menos um laço externo e nenhum problema. Problemas que impedem a gravação:
laço aberto, menos de três lados, lado de comprimento zero, linha que cruza outra do mesmo laço, linhas sobrepostas, laços
que se cruzam ou se tocam, furo fora do externo, laço dentro de furo, dois externos disjuntos e esboço vazio.

Na gravação há outras duas recusas: balanço negativo ou inválido, e inclinação fora da faixa. No telhado, o motor precisa
gerar águas para o contorno (`roofProblem`). Em qualquer recusa nada é criado: o modo fica aberto e o motivo vai para a barra.

## 5. Triângulo só no telhado

Cada aresta do laço externo do telhado tem um triângulo de inclinação: o clique o liga ou desliga ("define inclinação").
Piso, laje e forro não têm triângulo. Balanço e inclinação por aresta, no telhado, se editam pelo grupo de propriedades do
perímetro, com a aresta selecionada.

## 6. O que saiu

- A escolha de aresta por clique no telhado pronto, a tecla I sobre a aresta, o painel "Aresta N" e a tabela de arestas
  em Propriedades. A edição de aresta do telhado passa pelo modo.
- Os modos "Furo" de piso, laje, forro e telhado, com a opção de cada barra e o item da faixa.

## 7. Pendências

- **Contorno vinculado às paredes** (origem `walls-finish`, com Desvincular e Revincular): o modo não grava o vínculo. Só a
  ferramenta antiga de piso por paredes o criava. Hoje não há como criar um piso ou forro vinculado pela interface. A
  decidir: levar o vínculo ao modo (a partir da face escolhida) ou tirar da interface o que não se cria mais.
- **Forro "No ambiente"** (ligado ao ambiente, decisão 0021) também não é alcançado pela faixa. Mesma decisão.
- Os modos de criação antigos (poly, rect, walls, room, paredes, perímetro) continuam no código, com testes, porque o
  pacote ainda os testa. Remover quando a decisão de cima estiver tomada.
