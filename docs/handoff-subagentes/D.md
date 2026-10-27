# Tarefa D: itens menores do perímetro (seção 3.4 de docs/pendencias-perimetro.md)
Faça estes itens, um commit por item:
1. Telhado em arco selecionado mostra um quadradinho de grip por vértice amostrado; deve haver grips só nos cantos lógicos (vértices que não são pontos internos de um arco amostrado). Use a detecção de arco já existente (packages/tools/src/perimeterArcFit.ts) ou critério equivalente por ângulo entre lados curtos consecutivos. Locais: packages/render/src/plan/roofs*.ts, planOverlay, perimeterTool.
2. Aparar, Dividir, Deslocar e o ângulo da rotação usam o cursor sem snap. Faça-os usar o mesmo snap que o esboço usa (veja como perimeterTool aplica snap). Locais: packages/tools/src/perimeterToolModify*.ts. ATENÇÃO: outro agente (B) alterará esses arquivos depois; mantenha as mudanças pequenas e localizadas.
3. Destino digitado de Mover/Copiar é só distância na direção do cursor; aceite também "dx,dy" (dois números separados por vírgula ou ponto e vírgula, em metros). Local: perimeterToolInput.ts / perimeterToolModify*.ts.
4. activateView em apps/web/src/editor/viewTabActions.ts adiciona a aba mesmo quando a navegação é recusada com o modo de perímetro aberto: a aba só deve ser adicionada se a navegação for aceita.
5. Aviso antigo de lint exhaustive-deps em ShortcutsConfigDialog.tsx: corrija se for trivial.
Cada item com teste unitário. Se um item for inviável sem mudar o modelo, não faça e explique no relatório.
