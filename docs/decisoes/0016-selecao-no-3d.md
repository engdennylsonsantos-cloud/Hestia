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
