# Perímetro e telhado: estado atual e pendências

Documento de passagem de trabalho. Branch: `ccr-25143eb2-08pwa4` (último commit com o perímetro: "feat(perimetro): onda 4 concluída…"). Decisão de produto relacionada: `docs/decisoes/0033-modo-criar-editar-perimetro.md`. Ganchos antigos em `docs/perimetro-ganchos.md` (já aplicados).

## 1. Como rodar e validar

```
npm install
npm run typecheck && npm run lint && npx vitest run     # tudo verde na última rodada (423 arquivos, 4939 testes)
npm run build                                            # gera apps/web/dist (index.html e artifact.html via scripts/make-artifact.mjs)
node tests/e2e/perimetro-modificar.mjs                   # Playwright, usa apps/web/dist; também telhados, telhados-formas, pisos, lajes, contorno, forro-ambiente, anexar
```

Playwright/Chromium: `/opt/pw-browsers/chromium` (ver cabeçalho dos scripts em `tests/e2e`). O app expõe `window.__hestia` com `?debug=1`. O modo de perímetro: `editor.perimetro.view()` e `perimeterActions` (`apps/web/src/editor/perimeter.ts`).

Limites do repositório: eslint `max-lines` 420 (sem contar linhas em branco e comentários). `controller.ts` e `perimeterTool.ts` estão no limite: tire código para arquivos novos antes de acrescentar.

## 2. O que já existe (resumo)

Modo único "Criar/Editar perímetro" para telhado, piso, laje e forro:

- Contrato e validação: `packages/geom/src/sketchTypes.ts`, `sketchValidate.ts` (laços fechados, sem cruzar, sem sobrepor, laços não se tocam, furo dentro do externo, sem furo em furo).
- Sessão e comandos de Modificar (funções puras): `packages/tools/src/perimeterSession*.ts`, `perimeterModify*.ts`.
- Ferramenta: `packages/tools/src/perimeterTool.ts` (+ `perimeterToolModify*.ts`, `perimeterToolShape.ts`, `perimeterToolPick.ts`, `perimeterToolInput.ts`), formas em `sketchShapes*.ts`, captura em `sketchPickFace.ts`, `sketchByPerimeter.ts`, `sketchPickRoom.ts`.
- Conclusão e edição de elemento pronto: `perimeterCommit*.ts` (`commitPerimeter`, `draftFromElement`, recuperação de arcos em `perimeterArcFit.ts`).
- Planta: `packages/render/src/plan/sketch*.ts` (esboço), `dim.ts` (esmaecer o resto da planta), `roofs*.ts` (telhado pronto).
- App: `apps/web/src/editor/perimeter*.ts` (estado/controller), `apps/web/src/ui/perimeter/*` (faixa, galeria, barra de opções, propriedades), `ui/ribbon/*` (aba contextual, botões de Modificar).
- Decisões: concluir só por botão; triângulo de inclinação só no telhado, fora da aresta, fixo na orientação; furos são laços internos; telhado cujo esqueleto não fecha é recusado com o ponto; o vínculo às paredes voltou por "Por perímetro" + "Vincular às paredes" (origem `perimeter`; `walls-finish` só na ferramenta antiga), e o forro "Por ambiente" voltou por "Por ambiente" + "Acompanhar o ambiente"; Desvincular/Revincular estão nos grupos "Contorno".

## 3. Pendências (ordem sugerida)

### 3.1 Seleção de linhas e comandos de Modificar pouco dinâmicos (prioridade alta, feedback do usuário)

Problemas relatados: a linha selecionada quase não aparece como selecionada; para usar Deslocar e outros é preciso selecionar antes e só depois ligar o comando. O usuário quer o fluxo do Revit: ligar o comando e escolher o alvo.

Hoje: `packages/render/src/plan/sketch.ts` desenha a seleção como uma faixa azul fina (4 px, alpha 0,5) por baixo da linha. `perimeterToolModify*.ts` usa a seleção prévia; sem seleção, o primeiro clique só escolhe linhas e Enter confirma.

Plano:
1. Realce visível: linha selecionada em azul sólido, mais grossa que a rosa, com vértices cheios nas pontas e ponto no meio; hover em azul claro antes do clique; as linhas de origem dos comandos também realçadas.
2. Comandos dinâmicos: ligar Deslocar, Mover, Copiar, Rotacionar, Espelhar, Matriz e escolher a linha com o mouse. Deslocar com uma linha: prévia da cópia do lado do cursor, distância digitada (Enter) ou clique do lado. Tab alterna "só a linha" e "todo o laço conectado".
3. Janela de seleção (arrastar caixa), Shift soma, Ctrl subtrai, Ctrl+A seleciona tudo.
4. Barra de status sempre com o passo seguinte.
5. Atualizar `tests/e2e/perimetro-modificar.mjs` (hoje seleciona todas as linhas por `loadDraft` antes do Deslocar).

### 3.2 Telhado pronto em planta: muito "CAD", pouco BIM (prioridade alta, feedback do usuário)

> **Atualização 2026-10-27: resolvido.** Planta como em programa BIM: preenchimento por água na cor do material (`roofTile` quando o material não tem cor) com tom pela luz do sol do 3D; cortado pelo plano = contorno de corte cheio; acima do corte = só o contorno tracejado de sobreposição na cor da aresta (Archicad, "Projetado com sobreposição"); abaixo = contorno de projeção; arestas finas (rincão tracejado, linha de desnível da mansarda); **sem rosa** (o rosa `roofFootprint` ficou só no modo de edição, em `sketch*.ts`). A casa de exemplo ganhou o nível **Cobertura** (5,80 m), cuja planta corta o telhado. O texto abaixo é o histórico do pedido.

Problema: a planta mostra hachura cinza-roxo por água e linhas pretas de cumeeira e espigão. O usuário quer a representação do elemento como no Revit e no Archicad: projeção do 3D no plano de corte e na orientação da vista. As cores propostas quase não aparecem.

Plano (refação de `packages/render/src/plan/roofs*.ts`):
1. Superfície por água com o padrão e a cor do material do tipo de telhado (telha), mais tom por água segundo a orientação e a inclinação (sombreamento leve), para a inclinação ler no preenchimento.
2. Cumeeira, espigão e rincão como arestas finas entre superfícies (rincão tracejado), sem a hierarquia grossa atual.
3. Beiral e pegada pelo intervalo de vista: acima do corte em traço de projeção; pegada em rosa tracejado só com balanço; empena com o símbolo de perfil.
4. Anotações numa só camada: seta de caimento verde com a porcentagem, cota da cumeeira (hoje encosta na linha e no rótulo de área), rótulo de área.
5. Capturas lado a lado planta e 3D para 4 águas, 2 águas, shed, L e arco, inspecionadas antes de entregar.

**Decisão em aberto**: "usar as cores propostas" significa (a) rosa e verde só em projeção e setas, como na tabela de `docs/decisoes/0033…` e na proposta, ou (b) também uma cor própria de telhado (terracota) nas águas? A leitura provável do usuário é (b) mais (a). Confirmar.

Tokens já existentes: `theme.roofFootprint` (#c2185b claro, #ff6fb0 escuro), `theme.roofSlope` (#1f6f5c, #5cc3a6), tipos em `packages/render/src/plan/types.ts`.

Observações herdadas: com "linhas finas" ligadas (padrão desde 2026-10-25, decisão 0015 §6) todo traço vai a 1 px (`thin.ts`); a hierarquia de espessura só aparece desligando. Verificar como isso interage com a refação.

### 3.3 Esmaecimento da planta durante o modo: forte demais (prioridade média)

`packages/render/src/plan/dim.ts` mistura as cores com o fundo em `DIM_AMOUNT = 0.88`. Ficou claro demais; a planta deixa de servir de referência. Plano: reduzir para cerca de 0,65 depois de comparar capturas com 0,60, 0,65 e 0,70, mantendo o esboço, o snap e o realce de face em cor cheia. Opcional: opção "Esmaecer planta" na barra do modo.

### 3.4 Itens menores já conhecidos

- Telhado em arco selecionado mostra um quadradinho de grip por vértice amostrado; deveria haver só nos cantos lógicos (`packages/render/src/plan/roofs*.ts`, grips em planOverlay e `perimeterTool`).
- Arco no modelo é guardado como vários lados curtos. Na edição `perimeterArcFit.ts` recupera arcos, mas um arco de verdade no modelo exige mudança do modelo (`Roof.boundary`).
- Aparar, Dividir, Deslocar e o ângulo da rotação usam o cursor sem snap; a Matriz é só linear; `joinLoose` e `snapEndsToCorners` (`perimeterModifyJoin.ts`) não têm botão.
- Destino digitado de Mover/Copiar é só distância na direção do cursor (sem dx,dy).
- Cantos agudos abaixo de cerca de 11° são recusados (`MITER_LIMIT`).
- Três arestas que definem inclinação dão 3 águas (a quarta vira empena): conferir com o usuário se é o esperado.
- Telhado em L com duas águas e o resto empena é recusado (esqueleto não fecha, degrau de 0,60 m): decisão do usuário, teste ajustado.
- Modos antigos de criação (`poly`, `rect`, `walls`, `room`, `paredes`, `perimetro`) ainda existem nas classes de `FloorTool`, `SlabTool`, `CeilingTool` e `RoofTool`, inalcançáveis pela faixa; os seletores "Modo do contorno" ainda os listam. Plano de remoção e testes dependentes em §4.
- Piso/laje pela face de acabamento (`walls-finish`), criados pela ferramenta antiga de piso por paredes, não são criados pelo modo; pela faixa só o perímetro externo (`perimeter`) é vinculável. Decidir se o modo ganha um "Por ambiente" de piso/laje ou se fica só o perímetro externo.
- `tests/e2e/contorno.mjs` e `tests/e2e/forro-ambiente.mjs` ainda montam o vínculo pela API, com o comentário defasado de que o modo não o gravaria; migrar para "Por perímetro"/"Por ambiente".
- Piso/laje já vinculados às paredes não se editam pelo perímetro (decisão 0031: desvincular antes).
- `tests/e2e/visual-regression.mjs` falha em todos os casos porque a largura das capturas mudou de 672 para 908 px; revisar os baselines `telhado-*` antes de regenerar.
- Aviso de lint antigo: `ShortcutsConfigDialog.tsx` (exhaustive-deps).
- `activateView` em `viewTabActions.ts` adiciona a aba mesmo quando a navegação é recusada com o modo aberto.

## 4. Plano de remoção dos modos antigos

> **Atualização 2026-10-27: concluído** para `floorMode`, `slabMode`, `ceilingMode` e `roofMode` (opções, seletores e ramos das ferramentas; `git grep` não acha mais nenhum). `FloorTool`, `SlabTool`, `CeilingTool` e `RoofTool` ficaram como cascas mínimas só para o registro (`createTool` é um switch exaustivo sobre `ToolId`; o perímetro intercepta esses ids). Sobras: `roofShape` e `floorCore` não são mais gravados pela interface. Coberturas perdidas: ver o handoff 2026-10-27 (telhados e grades).

Os modos continuam nas classes e nos seletores "Modo do contorno" de `PlacementProperties.tsx` (linhas 49, 57, 65 e 71),
mas não são alcançáveis pela faixa: `PerimeterMode.intercepta` abre o modo de perímetro para `floor`, `slab`, `ceiling`
e `roof`. Antes de removê-los, migrar os testes abaixo para o perímetro/commit e trocar os roteiros e2e que ainda pedem
o modo antigo (ver §3.4). Depois, apagar os ramos, as opções `floorMode`/`slabMode`/`ceilingMode`/`roofMode` e os
seletores.

- **FloorTool** (`floorTool.ts`): `poly`, `rect`, `walls` e `perimetro`.
  - `poly`: `floorTool.test.ts`, bloco "contorno por cliques" (linhas 28–123).
  - `rect`: `floorTool.test.ts` (125–143); `tests/e2e/parede-recorte.mjs` (linha 57) pede `floorMode: 'rect'`, mas
    hoje `setTool('floor')` abre o perímetro, então o roteiro está defasado.
  - `walls`: `floorTool.test.ts` (145–179), `floorExtend.test.ts` (70–92) e `outlineEdit.test.ts` (20–46).
  - `perimetro`: `floorExtend.test.ts` (94–110) e `outlineEdit.test.ts` (48–54).
- **SlabTool** (`slabTool.ts`): `poly`, `rect` e `perimetro`.
  - `poly`: `slabTool.test.ts`, bloco "contorno por cliques" (27–130).
  - `rect`: `slabTool.test.ts` (132–150) e `slabSlope.test.ts` (linha 12).
  - `perimetro`: `slabTool.test.ts` (152–186) e `outlineEdit.test.ts` (56–64).
- **CeilingTool** (`ceilingTool.ts`): `poly`, `rect` e `room`.
  - `poly`: `ceilingTool.test.ts` (27–41).
  - `rect`: `ceilingTool.test.ts` (43–68).
  - `room`: `ceilingTool.test.ts` (71–105).
- **RoofTool** (`roofTool.ts`): `poly`, `rect` e `paredes`; `extrusao` é ferramenta própria e, aqui, cai em `poly`.
  - `poly`: `roofTool.test.ts` (casos de contorno por cliques, comprimento digitado e Enter/Esc), `roofPresets.test.ts`
    (casos de criação) e `roofExtrusionTool.test.ts` (126–137, `roofMode: 'extrusao'` cai em poly).
  - `rect`: `roofTool.test.ts` (casos de cumeeira, Tab, inclinação/cota, duas águas e beiral), `roofPresets.test.ts`,
    `attachRoof.test.ts`, `roofEdit.test.ts`, `roofArrowTool.test.ts` e `roofExtrusionTool.test.ts` (112–124).
  - `paredes`: `roofTool.test.ts` (blocos "pelas paredes com balanço" e "o beiral sai...").

Os demais testes que só trazem `floorMode`/`slabMode` no fixture (`arcTools`, `roomSeparator*`, `sectionTool`,
`selectModifiers`, `split*`, `tools`) não instanciam estas ferramentas; não bloqueiam a remoção.

## 5. Links

- App de teste (artefato, mesmo link, versão 9): https://claude.ai/artifact/1g2X1e1KYR8pYdD7t2N3P4
- Mock da proposta de interface: https://claude.ai/artifact/5jViyGhcSPEr2rcLRrZifx
- Proposta de cores e cumeeira: https://claude.ai/artifact/XBZeSVsH9QpyHUKU57qf82

## 6. Lições do processo

Validar só com testes passando deixou passar problemas de uso (seleção invisível, comandos sem ligação, planta do telhado fraca). Antes de entregar uma parte de interface ou de desenho: rodar o app com Playwright, tirar captura e olhar como o usuário olharia.
