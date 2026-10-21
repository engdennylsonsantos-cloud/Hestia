# Decisão 0016 · Seleção no 3D

Decidido em 2026-10-21 com o dono: selecionar elementos pela vista 3D (paredes, portas, janelas, pisos, lajes, telhados e escadas), com o mesmo caminho da planta (`useUi.selection`: propriedades, árvore e Delete).

## 1 · Contrato de dados (`packages/render/src/model3d/solids.ts`)
- `SolidBatch.ids: ElementRange[]`, com `ElementRange = { id, start, count }`: faixa de `indices` do lote. `start` e `count` são posições em `indices` (sempre múltiplos de 3, triângulos inteiros). Um elemento pode ter várias faixas no mesmo lote. `positions`, `normals` e `indices` não mudaram.
- Donos das faixas: parede = `wallId` (por camada); piso = `floorId`; laje = `slabId`; telhado = `roofId`, inclusive testeira, calha e forro do beiral; escada = `id` da escada. Em `stairSolids`, o `splitTJunctions` remapeia as faixas quando reescreve os triângulos.
- Esquadrias (`scene3d.ts`): cada peça (batente, vidro, folha) é uma malha com uma faixa que cobre a geometria inteira, com o id da abertura. O grupo e cada filho levam `userData.elementId`.
- Malhas do modelo: `Mesh.userData = { kind: GraphicsCategory, ranges: ElementRange[] }`. Continua um mesh por lote. No wireframe, o modelo não tem malhas (decisão 0015); a malha de picking fica numa camada à parte (`pickLayer`), sem cor nem profundidade.

## 2 · Picking (`pick3d.ts`)
- `pickElement(root, camera, ndc): { id, point: {x, y, z}, kind } | null`. Só entram as malhas com `userData.ranges`: chão, grade, arestas e realce ficam de fora. O triângulo atingido (`faceIndex × 3`) cai numa faixa, e a faixa dá o id.
- Categoria oculta não gera malha, então o raio passa por ela.
- `pickModelPoint` (ferramentas com `pick3d`, como anexar telhado) não mudou.

## 3 · Clique (`ViewportCanvas.tsx`, `controller.ts`)
- Clique sem arrasto, botão esquerdo, sem Espaço, na vista 3D, com ferramenta que não usa `pick3d`: `editor.clickSelect3d(id, additive)`.
- Sem Shift/Ctrl, o elemento clicado substitui a seleção. Com Shift/Ctrl, entra ou sai dela. Clique no vazio limpa a seleção (com Shift, mantém). Shift com arrasto continua sendo pan.
- Duplo clique na vista 3D não faz nada além dos dois cliques.

## 4 · Realce (`highlight3d.ts`, `ModelScene.highlight`)
- Sobreposição fora do modelo: a seleção com preenchimento a 0,35 e arestas firmes na cor `select` do tema; o elemento sob o cursor com preenchimento a 0,15 e arestas a 0,6 (não aparece se já estiver selecionado).
- Só a sobreposição é refeita, e só quando a seleção ou o cursor mudam. Refazer o modelo (`update`) descarta o realce.
- O cursor vira `pointer` sobre um elemento. O hover faz um raio por quadro de animação (o último ponto ganha) e limpa ao sair do canvas ou ao trocar de vista.

## 5 · Teclas (vista 3D, `controller.ts`)
- Esc limpa a seleção. Delete e Backspace excluem a seleção (Ctrl+Z desfaz). Teclas de ferramenta não atuam na vista 3D.

## 6 · Limitações
- As arestas do realce têm 1 px: o WebGL não tem espessura de linha, e a versão grossa exigiria linhas com geometria própria.
- O picking testa todos os triângulos do raio (custo linear no modelo). Sem BVH; se ficar lento em modelos grandes, o próximo passo é um BVH por lote.
- Sem seleção por janela no 3D (arrastar com o botão esquerdo continua orbitando).

## 7 · Seleção em cortes e elevações (vista `section`)
- Contrato: `pickSection(result, point, tolerance = 0): { id, kind } | null` (`packages/render/src/section/pick.ts`). O ponto é (t, z), em metros. Testa só os polígonos visíveis do motor (`cut`, `openings`, `beyond`); o que está totalmente oculto não é selecionável (intencional). Devolve id e categoria (parede, porta, janela, piso, laje, telhado ou escada).
- Ordem: do mais perto ao mais longe (profundidade). Em empate: corte, vão, além e, por fim, a ordem do motor (a mesma da oclusão). Primeiro vale o interior; se nenhum item contém o ponto, vale a borda a `tolerance`. A vista passa 4 px convertidos pelo zoom (`4 / zoom`, em `apps/web/src/editor/sectionPick.ts`).
- Corte unido: o motor une por material e não dá o polígono de cada origem. Com várias origens (por exemplo, paredes do mesmo tipo cortadas pela mesma linha), o id é o primeiro de `sources`. Limitação conhecida: a seleção pode apontar para o vizinho do mesmo material. A correção é o motor passar o polígono de cada origem (fora deste escopo).
- Clique sem arrasto, botão esquerdo, sem Espaço, na vista de corte: `clickSelect3d` (o mesmo caminho do 3D e da planta, com Shift/Ctrl). Arrastar continua movendo a vista. Delete e Backspace excluem a seleção; Esc fecha o corte, como antes.
- Cursor sobre um elemento: cursor `pointer` e contorno fraco (`highlight.hover`). Não é gravado no projeto.
- Realce: `buildSectionDrawList({ highlight: { selection, hover } })` adiciona, por último na lista, o preenchimento a 0,25 e o contorno na cor de seleção do tema sobre as partes visíveis do selecionado. O cursor só ganha contorno (0,55), e não aparece sobre um item já selecionado. Num corte unido, se uma origem está selecionada, a região inteira é realçada.
