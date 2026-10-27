# Tarefa A: realce e seleção de linhas no esboço do perímetro
Problema: a linha selecionada quase não aparece como selecionada. packages/render/src/plan/sketch.ts desenha a seleção como faixa azul fina (4 px, alpha 0,5) por baixo da linha.
Faça:
1. Realce visível da linha selecionada: azul sólido, mais grosso que a linha rosa, com vértices cheios nas pontas e um ponto no meio. Use tokens do tema existente (theme) e acrescente um token se precisar, nos dois temas (claro/escuro).
2. Hover: linha sob o cursor em azul claro antes do clique. O estado de hover deve vir do que a ferramenta já sabe (veja packages/tools/src/perimeterToolPick.ts e como o overlay recebe o estado em packages/render/src/plan/types.ts e apps/web/src/editor/perimeter*.ts); acrescente o campo necessário ao tipo de overlay se faltar.
3. As linhas de origem dos comandos de Modificar também realçadas (se já houver estado "origem", use-o).
4. Janela de seleção: arrastar uma caixa no vazio seleciona as linhas inteiras dentro dela (caixa da esquerda para a direita) ou que a toquem (direita para a esquerda). Shift soma à seleção, Ctrl subtrai, Ctrl+A seleciona todas as linhas do esboço. Clique no vazio sem Shift limpa a seleção.
5. A caixa de seleção deve ser desenhada durante o arraste (retângulo tracejado, cheio se da esquerda para a direita).
Arquivos prováveis: packages/render/src/plan/sketch*.ts, packages/tools/src/perimeterToolPick.ts, perimeterToolInput.ts, perimeterSession*.ts. NÃO altere perimeterToolModify*.ts (outro agente cuida).
Testes: unitários de seleção por janela, Shift, Ctrl e Ctrl+A (funções puras), e de geração dos comandos de desenho do realce quando houver teste de render vizinho.
