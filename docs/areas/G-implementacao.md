# G · O que foi implementado (29/10/2026)

Estado da entrega da planta de área. Para o desenho e as decisões, ver
[F-proposta-plantas-de-area.md](F-proposta-plantas-de-area.md) e a
[decisão 0037](../decisoes/0037-plantas-de-area.md).

## Como usar

1. **Arquitetura → Sala e Área → Ambiente** e clique dentro de um circuito fechado (ou use
   **Ambientes em todos os circuitos fechados**). Todo ambiente criado já tem rótulo na planta de área.
2. No navegador, em **Plantas de área**, botão direito → **Criar para todos os níveis**. Abra a planta.
3. A planta nasce **sem cor**: diagonais de referência atravessando cada ambiente, perímetro fino, rótulo no
   cruzamento e paredes claras. O texto do rótulo **não tem fundo** (não há halo branco).
4. **Arraste o rótulo**. Com o rótulo dentro do ambiente, as diagonais passam a cruzar no **centro do texto** e
   acompanham o arraste. Ao sair do ambiente, o X volta ao ponto de referência e a chamada de duas linhas cruzadas
   acompanha o rótulo, com o cruzamento no centro do texto.
5. **Clique dentro do ambiente** para selecioná-lo: preenchimento e contorno em destaque. No painel, escolha a
   **Categoria** e clique em **Gerenciar categorias…** para editar nome, código, cor e hachura.
6. **Anote como numa planta de piso**: Cota, Texto, Etiqueta, Linha/Região de detalhe, Medir e **Cotas automáticas…**
   funcionam na planta de área. As anotações ficam **presas a esta vista** (`AreaPlan.annotations`) e não vazam para a
   planta de piso. Ao criar a planta, as anotações do nível são copiadas; “Copiar anotações do nível” refaz a cópia.
7. Em **Cor (opcional)**, escolha **Por categoria**, **Por nível** ou **Por faixa**. Aí entram
   preenchimento, legenda e quadro. A cor de área aparece só na planta de área; a planta de piso usa o
   preenchimento neutro do tema.
5. Clique no rótulo (sem arrastar) para selecionar o ambiente e configurar **posição, rotação e chamada**
   no painel de propriedades.
6. Em **Cor (opcional)**, escolha **Por categoria**, **Por nível** ou **Por faixa**. Aí entram
   preenchimento, legenda e quadro.
7. Botão direito em **Plantas de área** → **Criar prancha geral**: uma vista por pavimento + quadro geral.

## Onde está

| Camada | Arquivo |
|---|---|
| Modelo | `packages/model/src/areaPlan.ts`, `areaPlanCommands.ts`, `types.ts` (`Room.referencePoint/labelPosition/labelRotation/labelLeader/categoryId`) |
| Geometria | `packages/engine/src/roomReference.ts` (centroide, polo, diagonais), `rooms.ts` (`roomRegions`, cache) |
| Cores e quadro | `packages/engine/src/areaPlan.ts` |
| Desenho | `packages/render/src/plan/areaPlan.ts`, `build.ts` (`buildAreaPlanGeometry`) |
| Prancheta | `packages/render/src/sheet/viewports.ts`, `sheet/build.ts`, `sheet/frame.ts` |
| Ações/UI | `apps/web/src/editor/areaPlanActions.ts`, `ui/AreaPlanProperties.tsx`, `ui/browser/Views.tsx`, `RoomProperties.tsx` |
| DXF | `apps/web/src/editor/dxfExport.ts` (`areaPlanDxf`) |
| IFC | `packages/io/src/ifc/ifcSpaces.ts` |

## Correções que vieram junto

- `wallsSignature` inclui a flecha (`sag`) do arco, e os caches são por projeto (`WeakMap`), não globais.
- `dropBandHoles` usa o retângulo **orientado** do separador (pilar ao lado de diagonal continua furo).
- Criação em lote usa `roomRegions` (mesma fonte do `resolveRooms`), com separadores e `wallFaces`; não cria
  ambiente no miolo de pilar.
- Duplicata no mesmo circuito não soma na tabela/quadro.
- Número repetido no nível: aviso. Pé-direito ≤ 0: erro.
- Referência e rótulo acompanham mover/girar/espelhar/copiar o ambiente.
- Rótulo, legenda e quadro seguem o tema claro/escuro; a prancha impressa continua em papel branco.
- O cache de circuitos usa a assinatura do conteúdo do nível (inclui a flecha `sag` do arco), então editar um nível não
  recalcula os outros e uma parede em arco não deixa área velha.

## Limitações conhecidas (próxima etapa)

- A colisão entre rótulos automáticos é resolvida subindo em degraus; ela não faz um layout global ótimo e pode
  empurrar um rótulo para fora de ambientes muito pequenos (com chamada). O usuário pode arrastar para ajustar.
- A planta de piso mostra nome + número + área; a decisão de mostrar só o nome não foi aplicada.
- `RoomTag` por vista existe no modelo, mas a UI ainda não expõe campos diferentes por planta (usa o padrão
  da planta).
- PDF da prancha de área é gerado pelo caminho existente de pranchas, mas não tem teste visual próprio.
- `ouroZoom.test.ts` tem 72 falhas de hash **pré-existentes**, iguais às do estado anterior; não são desta
  entrega.

## Seleção, texto e exclusão na planta de área (29/10/2026)

- **Cotas e textos da vista são selecionáveis**: a seleção lê `AreaPlan.annotations` quando a vista é de área
  (`annotationAt`, `dimGripAt`, `dimTextGripAt` com `planId`). Clicar seleciona; arrastar a alça da cota muda o
  deslocamento; arrastar a alça do texto move o texto (um passo de desfazer).
- **Propriedades**: o painel reconhece cotas, textos, linhas/regiões de detalhe e etiquetas da planta e edita a
  vista, não o nível. O texto tem conteúdo multilinha, altura, largura de quebra, rotação, moldura, alinhamento,
  negrito/itálico/sublinhado, posição X/Y e "Centralizar no ponto".
- **Excluir**: Delete remove as anotações da planta de área; o modelo continua bloqueado nessa vista.
- **Destaque**: texto/cota sob o cursor ganham realce; o texto selecionado ganha cor de seleção, caixa e um
  quadradinho no canto inferior esquerdo (fora do texto) para arrastar.
- **Caixa de texto**: com a ferramenta Texto ativa, o painel de colocação abre **Caixa de texto…**; o diálogo cria
  um texto com largura, moldura, quebra de linha, rotação e alinhamento no centro da vista (na planta de área, em
  `AreaPlan.annotations`). O texto criado pela ferramenta Texto continua aceitando Enter no campo e pode ser
  convertido em caixa pelas propriedades.
- Testes: `annotationPlanPick.test.ts` (tools), `notes.text.test.ts`/`frameBox.test.ts` (render),
  `AnnotationProps.test.ts`/`TextDialog.test.ts`/`PlanLabels.test.ts` (app). A suíte completa passa com as 72
  falhas de hash pré-existentes de `ouroZoom.test.ts`.