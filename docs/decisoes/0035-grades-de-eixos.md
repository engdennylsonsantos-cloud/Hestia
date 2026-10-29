# Decisão 0035 · Grades de eixos e grade de pontos

Decidido em 2026-10-27 com o dono. Referência: Revit (Grid). Código: `packages/model/src/grid.ts` (modelo e comandos),
`packages/tools/src/gridTool.ts` e `gridSelect*` (ferramenta e seleção), `packages/tools/src/gridSnapPoints.ts` (captura),
`packages/render/src/plan/grids.ts` (planta) e `apps/web/src/ui/Grid*.tsx` (opções, propriedades e tipo).

1. **Grade é do projeto, não de um nível.** `Project.grids` e `Project.gridTypes` (opcionais, sem migração, como as
   pranchas). Aparece na planta de todos os níveis, por cima do modelo e por baixo das anotações.
2. **Forma.** Dois pontos (reta, ou arco quando `sag` ≠ 0, flecha à esquerda de início→fim como `Wall.sag`, no máximo metade
   da corda) ou mais pontos (multissegmento, só reto). Cada trecho tem pelo menos 5 cm.
3. **Nome automático no padrão do Revit.** O sucessor da última criada: `1` → `2`, `A` → `B`, `Z` → `AA`, `A9` → `A10`.
   Nome único no projeto. Bolha só na ponta final por padrão, ligável em cada ponta.
4. **Tipo de grade** (`GridType`): segmento central (`continuous` | `none` | `custom`), comprimento das pontas, traço, cor
   (`null` = tinta do tema), padrão (`solid` | `dash` | `dashdot`) e a bolha (diâmetro e texto). Medidas em mm de papel.
   Dois tipos padrão (`gt_6mm` com traço-ponto contínuo e `gt_6mm_pontas`); os padrão não se removem; um tipo em uso não se
   remove.
5. **Ferramenta `grid`** (atalho `GR`; no perfil simples `VG`, porque as teclas livres acabaram e a Etiqueta passou a `VT`):
   Linha, Arco (3 cliques), Escolher linhas (eixo de parede, arco em parede curva) e Multissegmento (Enter ou duplo clique
   termina). Selecionar, alças nas pontas e no meio do arco, Mover/Copiar (a cópia ganha nome novo) e Delete.
6. **Captura.** Pontas, cruzamentos grade×grade e grade×eixo de parede, e "sobre a linha" (inclusive no arco), com as mesmas
   chaves de `SnapOptions` das paredes.
7. **Grade de pontos.** O botão **Grade** (faixa e Propriedades da vista) é uma chave só para o desenho dos pontos e para a
   captura (`setSnap({ grid })` mantém `showGrid` junto). O intervalo é configurável (Propriedades da vista, padrão
   automático pelo zoom) e vale para o desenho e para o snap; um intervalo que deixaria menos de 6 px entre pontos volta ao
   automático. Padrão: desligada (`DEFAULT_SNAP.grid = false`).
8. **Fora desta decisão (pendente):** Girar e Espelhar com grade selecionada, realce de passar o mouse (hover), extensão 2D/3D
   e caixa de escopo, quebra (cotovelo) da bolha, e a numeração por letra ao editar o nome da primeira.
