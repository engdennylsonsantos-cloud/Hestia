# Tarefa PV · Acabamento visual das prévias do diálogo do tipo

As prévias reais já funcionam (`apps/web/src/ui/dialogs/openingType/`: `previewProject.ts`, `previewViews.ts`, `previewScene.ts`, `Preview3D.tsx`, `OpeningTypePreview.tsx`, `drawListToSvg.ts`), mas a conferência visual no navegador mostrou defeitos de apresentação. Corrija-os **sem desenhar nada próprio das esquadrias** (continua tudo vindo dos renderizadores do projeto).

Leia: `apps/web/src/ui/dialogs/openingType/*`, `apps/web/src/styles.css` (bloco `.dialog.xl`), `packages/render/src/model3d/orbit.ts` e `scene3d.ts` (câmera e cena), `packages/render/src/section/build.ts` (como o corte é montado e enquadrado), `packages/model/src/openingStyle.ts`.

## Arquivos permitidos
`apps/web/src/ui/dialogs/openingType/*` (e testes), `apps/web/src/styles.css` (só o bloco `.dialog.xl` e filhos). Nada em `packages/`, a não ser que um defeito comprovado esteja numa função de `packages/render` que só a prévia usa (liste no relatório).

## Defeitos a corrigir
1. **3D pequeno demais.** A parede da prévia tem 3,6 m e a câmera abre muito: a porta ocupa 15% da área. Faça a câmera **enquadrar a esquadria**: parede de comprimento `largura + 1,2 m` e altura `altura + peitoril + 0,5 m` (porta: piso em z = 0 com uma laje fina de chão se isso for simples; senão só a parede), câmera orbital em torno do centro do vão com yaw ≈ −35° e pitch ≈ 20°, distância calculada para a caixa do vão (incluindo a folha aberta e o alizar) ocupar ~70% da altura da área. A folha **aparece aberta** em `angle3d` (se o ângulo for 0 aparece fechada). No modo "3D linhas" as arestas da esquadria têm de ficar legíveis (use a espessura de aresta do pipeline).
2. **Área de prévia pequena.** Aumente a coluna direita do diálogo para 460 px (a central cede) e a área da prévia para altura mínima de 340 px (proporção 4:3), com as verificações abaixo e rolagem só nessa coluna. Em telas < 1100 px a regra atual (coluna escondida) continua.
3. **Corte transversal ilegível.** Hoje o corte mostra a faixa inteira (altura toda por 0,19 m de espessura) e vira um traço. Mostre o corte como **três quadros**: o corte inteiro, pequeno e à esquerda, e dois **detalhes ampliados** empilhados à direita: "Cabeça" (z de `H − 0,40` a `H + 0,35`, mostrando batente, verga, folha e alizar) e "Soleira" (porta: z de −0,15 a 0,35; janela: peitoril, soleira saliente e contraverga, z de `sill − 0,35` a `sill + 0,35`). Cada quadro com o seu enquadramento (o `drawListToSvg` já aceita enquadramento) e título pequeno. Rótulos de cota: não adicione.
4. **Planta da prévia** deve usar o nível de detalhe **alto** quando `detail2d` for `'scale'` (a prévia é ampliada), e respeitar o fixo escolhido caso contrário; deve mostrar a folha fechada **e** a aberta (usa o desenho `high` do pipeline) com margem boa em volta (0,6 m); enquadre pelo vão mais o arco.
5. **Elevação**: enquadramento com 0,3 m de margem em volta do vão e o piso/linha de peitoril como o projeto desenha; a convenção do V vem do projeto (já vem).
6. **Maçaneta**: o tipo `ot_p90` mostra "Nenhuma" no diálogo embora o padrão de `openingHandle` para porta de giro seja `lever`. Descubra a causa (leitura do campo vs padrão) e corrija o diálogo para mostrar o valor efetivo (`openingHandle(tipo)`) e gravar só quando difere do padrão; faça o mesmo para os outros campos v2 com padrão por leitura (estilo da folha, estilo do batente, ângulos, grade, detalhe) para o seletor sempre mostrar o valor efetivo.
7. **Seletores de componente** (estilo de folha, maçaneta): as miniaturas devem ser legíveis (tamanho mínimo 56×42) e o selecionado destacado com o realce do tema.
8. Nada pode travar a digitação nos campos: mantenha o debounce.

## Critérios de aceitação (testes vitest; o ambiente não roda navegador)
- A função que calcula a câmera do 3D (nova, pura: `previewCamera(projeto, opening)` → posição/alvo/zoom) devolve, para `ot_p90` com folha aberta a 90°, uma caixa englobante que cabe no campo de visão com 70% ±10% de ocupação vertical (teste numérico), e muda ao mudar largura, altura, ângulo e alizar.
- `previewProject`: parede com `largura + 1,2` de comprimento e a altura pedida.
- Corte: a função de vistas devolve três SVGs (inteiro, cabeça, soleira) com enquadramentos distintos e não vazios para os 23 tipos padrão (`DEFAULT_OPENING_TYPES`), sem exceção.
- Planta: com `detail2d` `'scale'` o detalhe usado é `'high'`; com `'low'` é `'low'`.
- Seletores: render em string mostra o valor efetivo (`openingHandle`) como selecionado para o `ot_p90` (lever) e para um tipo que grava `handle: 'none'`.
- `npx vitest run apps/web/src/ui` verde; `tsc` e `check-boundaries` limpos.
