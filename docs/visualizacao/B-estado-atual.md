# B · Estado atual: o que controla a aparência do Hestia

Data: 2026-10-21. Somente leitura: nenhum código foi alterado. Caminhos relativos à raiz do repositório (`/home/user/Hestia`). "Linha" = linha do arquivo.
Par: `A-pesquisa.md` (ferramentas do Revit e do ArchiCAD).

## 1. Resumo

- **Espessuras da planta são constantes em pixels de tela.** Não existe escala de vista (1:50, 1:100...) nem peso de linha por categoria configurável. Cada tipo de traço tem um número fixo no código.
- **Não há estilo visual por vista.** Não existe "Wireframe/Hidden/Shaded" nem sobrescrita gráfica por categoria ou por elemento, nem filtros, nem modelos de vista, nem pen sets.
- **`settings.detail` não é só da escada.** O brief diz que só a escada usa. O código mostra uso em **pisos, lajes, telhados, escadas e no próprio `build.ts`** (ver §3.5). Não é usado no 3D, na seção nem no DXF.
- **`settings.detail` é do projeto, não da vista.** `docs/03-INTERFACE.md` (§3 e §4) diz "por vista"; o código guarda no projeto (`packages/model/src/types.ts:361-369`).
- **Cores: uma por material.** O mesmo `Material.color` alimenta a planta (misturado com o papel) e o 3D (direto).
- **3D sem configuração por vista.** Sombras e Arestas são estado global de sessão; não são salvas.
- **Tema claro/escuro é estado de sessão**, não persistido. Escolha em `apps/web/src/editor/state.ts:139`.
- **DXF sem peso de linha.** Só tipo de linha e cor ACI, por camada (`packages/io/src/dxf.ts:208-218`).
- **Hachura `solid` sem efeito visível** em nenhum dos dois renderizadores, mas é oferecida no diálogo de materiais e usada por alumínio e telha metálica (ver §3.4).

## 2. Mapa de arquivos

| Arquivo | Papel na aparência | Notas |
|---|---|---|
| `packages/render/src/plan/build.ts` | Monta a lista de desenho da planta (`buildPlanDrawList`, 96–305) | Orquestra tudo; lê `settings.detail` em 108 |
| `packages/render/src/plan/types.ts` | `StrokeOp.widthPx` (11–20), `PlanTheme` (39–55), `LIGHT` (57–72), `DARK` (74–89) | Cores de tinta, seleção, escada, subpavimento |
| `packages/render/src/plan/color.ts` | `mix(a, b, t)` | Única função de mistura usada |
| `packages/render/src/plan/view.ts` | Vista da planta por nível: classifica elementos e refaz a geometria com o corte (56–103); contornos fora do corte (112–123); fantasma de seleção oculta (144–195) | Traços 1 px; projeção tracejada 6/3 |
| `packages/render/src/plan/floors.ts` | Pisos: preenchimento, hachura, faixa de contorno (62–87) | Mistura 0,74 claro / 0,42 escuro |
| `packages/render/src/plan/slabs.ts` | Lajes e seta de caimento (21–73) | Mistura 0,6 / 0,38 |
| `packages/render/src/plan/roofs.ts` | Telhados: alpha, tom por orientação, linhas notáveis (172–218); projeção (224–235); seleção (237–258) | Alpha 0,55 / 0,8 / 1 |
| `packages/render/src/plan/stairs.ts` | Escadas (152–198) | Sem hachura |
| `packages/render/src/plan/symbols.ts` | Símbolo de abertura: peso 1,2 px × peso relativo (9–17) | Vem de `packages/geom/src/openingSymbol.ts` |
| `packages/render/src/plan/grid.ts` | Grade: passo com ≥ 14 px entre linhas (8–33) | Traços 1 px |
| `packages/render/src/plan/sectionMarks.ts` | Marcas de corte e elevação (52–68) | 1,5 / 1,2 / 1 px |
| `packages/render/src/plan/cpuPlan.ts` | Renderizador Canvas2D (CPU). `lineWidth = widthPx` (74–88); hachura em 8 px (7–36) | Usado só sem GPU |
| `packages/render/src/plan/gpuPlan.ts` | Renderizador WebGL. Espessura convertida como `widthPx / zoom` (173), ou seja, constante na tela; textura de hachura (18–45) | Principal |
| `packages/render/src/plan/viewport.ts` | `zoom` em px por metro (linha 3) | Base de todas as conversões |
| `packages/render/src/model3d/scene3d.ts` | Cena 3D (`ModelScene`, 16–191): luzes, chão, fundo, névoa, material, arestas, sombras | Sem `detail`, sem escala |
| `packages/render/src/model3d/*.ts` (solids, stairSolids, eaveSolids, roofSolids, orbit, pick3d) | Malhas e câmera | Não leem configuração de aparência |
| `packages/render/src/section/build.ts` | Cortes e elevações (`buildSectionDrawList`) | Sem `detail` (0 ocorrências) |
| `apps/web/src/editor/state.ts` | Estado da UI, `useUi` (11–44 e 131–160); preferências no navegador (46–97) | Ver §7 |
| `apps/web/src/ui/Ribbon.tsx` | Faixa Vista: grupos Navegar (145), Cortes (151), Planta (159), 3D (166), Documentar (191) | Sem `detail`, sem escala |
| `apps/web/src/ui/Properties.tsx` | Aba Vista (`ViewProps`, 305–335): Grade 313, Subpavimento 314, Projeção 315, Etiquetas 316, Depurar 317, Nível de detalhe 318–323, 3D 328–331, Padrões 332–335 | Única tela do `detail` |
| `apps/web/src/ui/ViewportCanvas.tsx` | Decide claro/escuro (`useDark`, 11–34); reconstrói o 3D pela chave `version|dark|shadows|edges` (144–148); chama `buildPlanDrawList` (170–198) | Ponto de ligação |
| `apps/web/src/ui/TitleBar.tsx` | Botão de tema: sistema → claro → escuro (12–15, 71–72) | |
| `apps/web/src/App.tsx` | Aplica `data-theme` no `<html>` (102–113) | Preserva o valor do host em "sistema" |
| `apps/web/src/ui/SectionCanvas.tsx` | Chama `buildSectionDrawList` (11–16) | Passa só `showGrid` |
| `packages/model/src/types.ts` | `HatchKind` (13), `Material` (15–27), `DetailLevel` (359), `ProjectSettings` (361–369), `Project` (381–397) | Modelo de dados |
| `packages/model/src/defaults.ts` | Padrões de settings (138) e de materiais com hachura (21–37) | |
| `packages/model/src/migrate.ts` | Acrescenta `detail: 'medium'` a projetos antigos (73) | |
| `packages/model/src/commands.ts` | `setSettings` (67, 364) | Editável por comando |
| `packages/model/src/history.ts` | Desfazer de `setSettings` (196) | Entra no histórico |
| `packages/io/src/dxf.ts` | Camadas e estilo de linha, sem peso (87–127, 208–218) | |
| `apps/web/src/ui/dialogs/MaterialsDialog.tsx` | Campo "Hachura de corte" (89–90) | Oferece `solid` |

## 3. Planta

### 3.1 Ordem de desenho (`build.ts`)

1. Grade (104).
2. Subpavimento apagado: silhueta do nível de baixo, pisos, lajes, escadas e telhados de referência (118–155). Em cobertura, só preenchimento.
3. Lajes, depois pisos (157–169), depois escadas (170–176).
4. Paredes: por cluster; regiões por material; contorno de conjunto (177–197).
5. Contornos das paredes fora do corte (199).
6. Membranas, só no fino (202–207).
7. Pontas com "não unir" (210–219).
8. Símbolos de abertura (222–228).
9. Telhados (231–234); cobertura por cima das paredes.
10. Marcas de corte e elevação (241–244), etiquetas (247–248), depuração (248).
11. Seleção e pré-visualização (250–303).

A planta de cobertura (`roofPlanMode`) usa telhados opacos e paredes só como contorno (110–111, 144–146, 235–238).

### 3.2 Pesos de linha (todos em px de tela)

| Elemento | Espessura (px) | Cor e alfa | Tracejado | Arquivo:linha |
|---|---|---|---|---|
| Contorno do conjunto cortado (silhueta da parede) | **2,2** | `ink`, 1 | — | `build.ts:196` |
| Interface entre materiais na parede | **1** | `mix(ink, papel, 0,35)` | — | `build.ts:192–193` (só se fino, ou espessura ≥ 1,6 px) |
| Membranas (camadas de espessura zero) | 1 | `inkSoft`, 0,9 | 6/3 | `build.ts:205` (só no fino) |
| Pontas "não unir" | 1,4 | `guide`, 0,95 | — | `build.ts:216–217` |
| Parede fora do corte, projeção acima | 1 | `inkSoft`, 1 | 6/3 | `view.ts:114` |
| Parede fora do corte, projeção abaixo | 1 | `inkSoft`, 0,8 | — | `view.ts:115` |
| Parede "além" | 1 | `underlay`, 0,9 | — | `view.ts:116` |
| Símbolo de abertura, traço principal | 1,2 × peso 1 | `ink` | — | `symbols.ts:9–13`, `openingSymbol.ts:70–71` |
| Símbolo de abertura, traço secundário (arco de giro, maxim-ar) | 1,2 × 0,8 e × 0,7 | `inkSoft` | 4/3 (arco) | `openingSymbol.ts:119,131` |
| Abertura acima do corte | igual ao principal | `ink` | 6/3 | `view.ts:132` |
| Abertura abaixo ou "além" | igual, na cor secundária | `inkSoft` | — | `view.ts:133` |
| Subpavimento (silhueta e pisos de baixo) | 1 | `underlay`, 0,7 | — | `build.ts:122`, `floors.ts:145`, `slabs.ts` (via `belowFloorOps`), `stairs.ts:203` |
| Piso: contorno como faixa | **1,5 px** preenchidos | `mix(ink, papel, 0,35)` | — | `floors.ts:76–77` |
| Laje: contorno como faixa | 1,5 px | idem | — | `slabs.ts:59–60` |
| Laje: seta de caimento e percentual | 1,4 | `ink`, 0,9 | — | `slabs.ts:32` |
| Telhado: cumeeira | **2,2** | `ink` | — | `roofs.ts:196` |
| Telhado: espigão e rincão | 1,6 | `ink` | rincão 6/3 | `roofs.ts:195–196` |
| Telhado: empena (aresta sem inclinação) | 1,4 traço + 1,6 marca | `ink` | 12/5 | `roofs.ts:77–78` |
| Telhado: beiral como faixa | 1,5 px | `mix(ink, papel, 0,35)` | — | `roofs.ts:187–188` |
| Telhado: projeção fora do intervalo (contorno) | 1 | `inkSoft`, 0,9 | 6/3 | `roofs.ts:231` |
| Telhado: "define inclinação" (triângulo) | 1,4 vazado; cheio em `accent` | `inkSoft` | — | `roofs.ts:103` |
| Telhado selecionado | 2, sólido; tracejado 10/5 nas empenas | `select` | 10/5 | `roofs.ts:131,144` |
| Escada: espelhos | 1,4 | `ink` | — | `stairs.ts:23,174` |
| Escada: contorno de degrau | 1 | `mix(ink, papel, 0,35)` | tracejado acima do corte | `stairs.ts:135–137` |
| Escada: seta de subida e símbolo de corte | 1,4 | `ink`, 0,9 | — | `stairs.ts:97,127` |
| Marca de corte (tracejada) | 1,5 | `accent`, 0,95 | 7/5 | `sectionMarks.ts:56` |
| Marca de corte (corte) | 1,2 | `ink`, 0,9 | traço e ponto | `sectionMarks.ts:61–67` |
| Marca de elevação | 1 | `inkSoft` | — | `sectionMarks.ts:58` |
| Grade (menor e maior) | 1 | `gridMinor` / `gridMajor` | — | `grid.ts:23–27` |
| Eixos de origem | 1 | `inkSoft`, 0,5 | — | `grid.ts:30–31` |
| Seleção de parede | 2 | `select` | — | `build.ts:275` |
| Vértices de seleção | quadrado de 9 px (4,5/zoom de meia-lado) | branco com borda `select` 1,6 | — | `build.ts:281–291` |
| Fantasma de elemento oculto selecionado | 1 | `select`, 0,9 | 5/3 | `view.ts:166` |
| Pré-visualização e guias | 1 a 2 | variados | — | `overlay.ts` |

Os traços são desenhados em espessura de tela. Não há tradução para milímetros de papel nem para escala. Trocar o zoom não muda a espessura da linha, só a distância entre elas. Confirmado em `gpuPlan.ts:173` (`w = widthPx / zoom`, em unidades de mundo) e `cpuPlan.ts:85` (`lineWidth = widthPx`).

### 3.3 Cores e temas

- **Fonte da cor.** `Material.color` (`types.ts:17`, "Cor de aparência (3D e preenchimento de planta)"). Um só valor para as duas vistas.
- **Mistura com o papel.** A planta não usa a cor do material direto. Ela mistura com o papel (`mix`) com fração fixa:

| Elemento | Claro | Escuro | Arquivo:linha |
|---|---|---|---|
| Parede (região) | 0,58 com `#ffffff` | 0,50 com `theme.bg` | `build.ts:102,184` |
| Piso | 0,74 | 0,42 | `floors.ts:70` |
| Laje | 0,60 | 0,38 | `slabs.ts:54` |
| Telhado (água) | 0,50 | 0,30 | `roofs.ts:182` |
| Escada | 0,74 | 0,42 | `stairs.ts` (mesma regra do piso) |

- **Tom por orientação.** Telhado: água voltada para a luz de noroeste fica 6 % mais clara; a outra, 6 % mais escura (`roofs.ts:13,33–36`).
- **Material sem cor:** `#999999` (várias linhas, p. ex. `build.ts:184`).
- **Paletas fixas.** `LIGHT` e `DARK` (`types.ts:57–89`) são constantes. Tinta `#16181c` / `#e8eaee`, acento `#0f766e` / `#2dd4bf`, seleção `#1d6fe0` / `#5aa2ff`. Não há configuração.
- **Escolha do tema para a planta:** `ViewportCanvas.tsx:11–34` (`useDark`). Se `ui.theme` é `system`, usa `data-theme` do `<html>`, depois `prefers-color-scheme`. Quando `data-theme` muda, relê (MutationObserver).
- **Tema do 3D:** `scene3d.ts:82,120–123` e `120` (chão). Fundo claro `0xdfe7ee`, escuro `0x14171b`, névoa de 60 a 170 m.

### 3.4 Hachuras

- **Tipos.** `HatchKind = 'solid' | 'diagonal' | 'cross' | 'dots' | 'none'` (`types.ts:13`). Cada material tem um (`types.ts:15–27`, campo `hatch`). Padrões dos materiais de exemplo em `defaults.ts:21–37`.
- **Cor da hachura.** `mix(material.color, preto ou branco, 0,45)` (`build.ts:188`, `floors.ts:71`, `slabs.ts:55`, `roofs.ts:183`).
- **Quando aparece:**

| Elemento | Regra | Arquivo:linha |
|---|---|---|
| Parede | hachura se material ≠ `none` **e** (fino **ou** (espessura ≥ 5 px **e** zoom ≥ 40)) | `build.ts:187` |
| Piso e laje | fora do grosseiro **e** (fino **ou** zoom ≥ 40) | `floors.ts:71`, `slabs.ts:55` |
| Telhado | fora do grosseiro **e** (fino **ou** zoom ≥ 40) | `roofs.ts:183` |
| Escada | nunca | `stairs.ts` (sem hachura) |
| Corte e elevação | zoom ≥ 40 (sem regra de `detail`) | `section/build.ts:73` |

- **`solid` não desenha nada visível.** O CPU só trata `diagonal`, `cross` e `dots` (`cpuPlan.ts:19–33`). O GPU gera textura de hachura para os mesmos três (`gpuPlan.ts:26–41`), e `solid` gera textura vazia. **[INFERIDO do código]**. O diálogo de materiais oferece `solid` (`MaterialsDialog.tsx:89–90`), e dois materiais de exemplo o usam (`defaults.ts:34` alumínio, `37` telha metálica).
- **Dois renderizadores, padrões diferentes.** CPU: tile de 8 px, traço de 1 px (`cpuPlan.ts:7–36`). GPU: textura de 64 px, traço de 3 px (`gpuPlan.ts:18–45`). **[INFERIDO]** a hachura de planta aparece diferente conforme a GPU esteja disponível.

### 3.5 Uso de `settings.detail`

`detail` lê-se em `p.settings.detail ?? 'medium'` (`build.ts:108`). Quem usa:

| Módulo | Linhas | Efeito |
|---|---|---|
| `build.ts` | 108–109 | Define `fine`. |
| `build.ts` | 146, 158, 164, 171, 231 | Passa `detail` a telhados de baixo, lajes, pisos, escadas e telhados. |
| `build.ts` | 178–181 | **Grosseiro:** cada cluster vira só o contorno com preenchimento `mix(inkSoft, papel, 0,5)`, sem regiões de material. |
| `build.ts` | 187 | Hachura de parede (ver §3.4). |
| `build.ts` | 192 | **Médio e grosseiro:** interfaces de material só se a espessura ≥ 1,6 px. **Fino:** sempre. |
| `build.ts` | 202 | **Fino:** membranas tracejadas. |
| `build.ts` | 222 | **Grosseiro:** sem símbolos de abertura. |
| `floors.ts:65,71,73` | Hachura no fino ou zoom ≥ 40, nunca no grosseiro. Faixa de contorno fora do grosseiro. |
| `slabs.ts:49,55,58–65` | Igual aos pisos. Seta de caimento e percentual fora do grosseiro. |
| `roofs.ts:175–176,186,206–207` | Alpha 0,8 no grosseiro. Sem faixa, linhas, setas ou etiquetas de área no grosseiro. Cota da cumeeira aparece sempre na cobertura. |
| `stairs.ts:163–170` | **Grosseiro:** só a pegada, sem degraus. |
| `stairs.ts:183–188` | **Fino:** número de cada degrau. |

Não usam `detail`: `packages/render/src/section/build.ts` (0 ocorrências), `packages/render/src/model3d/*` (3D), `packages/io/src/dxf.ts` e `dxfExport.ts`, a grade, o fantasma de seleção e as etiquetas (`showTags`).

Padrão `medium` (`defaults.ts:138`, `migrate.ts:73`). Projetos antigos recebem `medium`.

### 3.6 Intervalo de vista (decisão 0013) e aparência

- A vista de planta usa `planViewOf` (`view.ts:91`). Ela classifica cada elemento (corte, projeção acima ou abaixo, além, oculto), refaz a geometria com o plano de corte (`view.ts:71`) e desenha só o contorno do que está fora do corte.
- Cobertura: planta de cobertura usa a geometria padrão (`build.ts:114`).
- Por nível: `Level.viewRange` (`packages/model/src/level.ts:9`), salvo no projeto. Não é por vista de planta, que é uma por nível.

## 4. 3D (`packages/render/src/model3d/scene3d.ts`)

| Item | Valor | Linha |
|---|---|---|
| Opções recebidas | `{ edges, shadows, dark }` | 9–13 |
| Luz hemisférica | `0xf4f7fb` / `0xb9b2a4`, intensidade 1,25 | 28 |
| Sol (direcional) | `0xffffff`, intensidade 2,1; posição calculada pelo tamanho do modelo: `c + r·(0,7; −0,5; 1,1)` | 21, 125–129 |
| Sombra | mapa de 2048 px; `bias −0,0004`; `normalBias 0,03` | 33–35 |
| Chão | plano de 400 m; `0xe3dfd6` claro, `0x2a2f36` escuro; receive shadow | 38–44, 120 |
| Grade do chão | 100 divisões, cores `0xb9b3a6` e `0xcfcabd`, opacidade 0,45 | 45–50 |
| Fundo e névoa | fundo `0xdfe7ee` / `0x14171b`; névoa 60–170 m | 121–123 |
| Material | `MeshStandardMaterial`: cor do material; rugosidade = 1 − gloss × 0,75; opacidade do material | 53–68 |
| Metal | `metalness 0,5` **só** para o id `mat_aluminio` (valor fixo no código) | 60 |
| Arestas | `EdgesGeometry` com limiar de 28°; `LineBasicMaterial` `0x1c2026` (claro) / `0xd7dde5` (escuro), opacidade 0,5 | 82, 102–105 |
| Sombras | `castShadow`/`receiveShadow` por malha, ligados por `opt.shadows` | 99–100, 124 |
| Aberturas | caixas simples: batente, vidro (`glassMaterialId`), folha | 141–173 |

- **Espessura de aresta.** `LineSegments` do WebGL: não há peso configurável; **[INFERIDO]** a espessura é a da implementação (normalmente 1 px).
- **Atualização.** Reconstrói só quando muda `store.version`, `dark`, `shadows` ou `edges` (`ViewportCanvas.tsx:144–148`).
- **Mapa de sombras** ligado no renderizador (`ViewportCanvas.tsx:154`).

## 5. Corte e elevação (`packages/render/src/section/build.ts`)

- Papel: `#ffffff` claro, `theme.bg` escuro (31).
- Silhueta de corte: 2,2 px (77). Contornos de elementos cortados: 1 px; aberturas: 1,6 (cortada) ou 1,2 (projeção) (66).
- Profundidade: tom de traço misturado com o papel conforme a profundidade (50).
- Hachura: só com zoom ≥ 40 (73). Não usa `detail`.
- Linha tracejada de borda: 1 px, tracejado 10/5 (40).
- Nenhuma opção de aparência por vista além de `showGrid` (`SectionCanvas.tsx:15`).

## 6. Interface: onde o usuário mexe

### 6.1 Faixa Vista (`apps/web/src/ui/Ribbon.tsx:139–190`)

| Grupo (linha) | Controles | Estado |
|---|---|---|
| Navegar (145) | Enquadrar | ação |
| Cortes (151) | Corte | ferramenta |
| Planta (159) | Grade, Subpavimento, Mostrar projeção da cobertura | `ui` (global), a última em localStorage |
| 3D (166) | Sombras, Arestas | `ui` (global), não persistido |
| Documentar (191) | Cinco tabelas (paredes, pisos, lajes, telhados, escadas) | diálogos |

Não há na faixa: nível de detalhe, escala, estilo visual, etiquetas, pesos, hachura, tema.

### 6.2 Aba Vista em Propriedades (`apps/web/src/ui/Properties.tsx:305–335`)

Aparece quando nada está selecionado (`Properties.tsx:~376`, ramo `: <ViewProps />`).

| Controle | Linha | Escopo | Onde é salvo |
|---|---|---|---|
| Nível (seletor) | 309–311 | sessão | `ui.levelId` |
| Elevação | 312 | leitura | `Level.elevation` |
| Grade | 313 | global | `ui.showGrid` (sem persistência) |
| Subpavimento | 314 | global | `ui.showUnderlay` (sem persistência) |
| Mostrar projeção da cobertura | 315 | navegador | `localStorage` `hestia.roofProjection` (`state.ts:81–92`) |
| Etiquetas de parede | 316 | projeto | `settings.showTags` (undo: sim) |
| Depurar junções | 317 | projeto | `settings.debugJoins` |
| Nível de detalhe | 318–323 | **projeto** | `settings.detail` (undo: sim) |
| Editar níveis | 324 | diálogo | — |
| Intervalo de vista (só na planta) | 326 | nível | `Level.viewRange` |
| Sombras | 329 | global | `ui.shadows` (sem persistência) |
| Arestas | 330 | global | `ui.edges` (sem persistência) |
| Tolerância de junção | 333 | projeto | `settings.joinTolerance` |
| Altura de parede | 334 | sessão | `ui.options.wallHeight` |

Tema não aparece nas Propriedades. Fica no botão da barra de título (`TitleBar.tsx:12–15`).

## 7. Estado: por projeto, por vista, global ou de navegador

| Item | Escopo real | Persistência | Referência |
|---|---|---|---|
| `settings.detail` | Projeto (todas as plantas) | No projeto; undo sim | `model/types.ts:368`, `history.ts:196` |
| `settings.showTags`, `debugJoins`, `joinTolerance` | Projeto | No projeto | `model/types.ts:361–369` |
| `Level.viewRange` | Nível (planta) | No projeto; undo sim | `model/level.ts:9`, decisão 0013 |
| `Material` (cor, hachura, brilho, opacidade) | Projeto | No projeto | `model/types.ts:15–27` |
| `SectionView` (nome, tipo, linha, profundidade) | Projeto; **sem atributos de estilo** | No projeto | `model/types.ts` (`SectionView`) |
| Estilo visual por vista | **Não existe** | — | — |
| Escala de vista | **Não existe** | — | — |
| Pesos de linha por categoria e escala | **Não existem** (constantes no código) | — | §3.2 |
| Modelos de vista, filtros, sobrescritas, pen sets | **Não existem** | — | — |
| `ui.theme` | Sessão | **Não persiste** | `state.ts:20,139` |
| `ui.showGrid`, `showUnderlay`, `shadows`, `edges` | Sessão | **Não persiste** | `state.ts:27,28,31,32,146–150` |
| `ui.showRoofProjection` | Navegador | `localStorage` `hestia.roofProjection` | `state.ts:81–92` |
| `options.snap` (capturas) | Navegador | `localStorage` `hestia.snap` | `state.ts:46–75` |
| Projeto (todo) | Navegador | autosave em `localStorage` | `controller.ts:404,449,453` |

Não existe nenhum objeto "vista" com estado de aparência. A planta é um nível; o 3D é uma cena global; a seção é `SectionView` sem estilo.

## 8. Divergências entre documentação, brief e código

| # | Afirmação | Onde | Código | Situação |
|---|---|---|---|---|
| 1 | "`detail` é usado só pela escada" | brief | Usado em pisos, lajes, telhados, escadas, paredes e `build.ts` (§3.5) | **Brief incorreto** |
| 2 | "Cada vista tem escala e nível de detalhe" | `docs/03-INTERFACE.md:67–69` | `detail` é do projeto (`settings`); não há escala | **Divergente** |
| 3 | "Nada selecionado → propriedades da vista: escala, nível de detalhe, estilo visual" | `docs/03-INTERFACE.md:56` | Escala e estilo visual inexistentes | **Divergente** |
| 4 | "2D renderiza vetor com pesos de linha por categoria e escala" | `docs/03-INTERFACE.md:67` | Pesos fixos em px, sem categoria configurável nem escala | **Divergente** |
| 5 | "Modelos de vista (templates) aplicáveis a várias vistas" | `docs/03-INTERFACE.md:70` | Não existem | **Lacuna** |
| 6 | "Fases" | `docs/05-REFERENCIA-REVIT-ARCHICAD.md:150` (lacunas) | Fases não existem no modelo | Já reconhecido |
| 7 | Projeção da cobertura: tela só com preferência ligada; DXF sempre | `docs/decisoes/0013` §4 | Igual ao texto da decisão | Já registrado na decisão |
| 8 | Hachura `solid` | `types.ts:13` e diálogo | Sem efeito visível (§3.4) | **Não documentado** |
| 9 | Metal do alumínio | `scene3d.ts:60` | Id fixo `mat_aluminio` | Acoplamento (não é divergência de doc) |

## 9. Lacunas para decidir (antes de implementar qualquer coisa)

1. **Escala é propriedade da vista ou do projeto?** Sem ela não há como converter milímetros de papel em pixels; hoje as espessuras são de tela.
2. **Unidade de peso.** Converter os pesos para mm (de papel) e calcular px por escala, ou manter px e variar só por escala?
3. **`detail` por vista ou por projeto.** O código e o brief divergem. Hoje é por projeto; `docs/03` pede por vista.
4. **Semântica de `solid`.** Preenchimento cheio na cor do material? Ou sobra de tipo sem implementação?
5. **Pesos por categoria onde?** No projeto (`settings`), num modelo de vista, ou em tipos de material/elemento?
6. **Sombras e Arestas e tema** são preferência de sessão, como a projeção da cobertura, ou devem ir para o projeto?
7. **DXF com peso de linha:** a linguagem de peso do DXF (`LWEIGHT`) é desejada? Hoje não há.
8. **Hachura de planta diferente entre GPU e CPU** (§3.4): alinhar os dois?
9. **Estilo visual "Wireframe" e "Hidden Line"** para o 3D: não existem; faz sentido? (Dado da pesquisa: Revit usa Hidden Line como padrão de vista; `A-pesquisa.md` §1.1.)

## 10. Referências rápidas (linhas exatas)

- Pesos da planta: `packages/render/src/plan/build.ts:196,192,205`, `view.ts:114–116,132–133`, `floors.ts:76–77`, `slabs.ts:59–60`, `roofs.ts:77–78,103,131,144,187–188,195–196,231`, `stairs.ts:23,97,127,135–137`, `sectionMarks.ts:56–67`, `grid.ts:23–31`.
- Escala e zoom: `packages/render/src/plan/viewport.ts:3,13–14`, `gpuPlan.ts:173`, `cpuPlan.ts:85`.
- Tema da planta: `apps/web/src/ui/ViewportCanvas.tsx:11–34`, `apps/web/src/ui/TitleBar.tsx:12–15`, `apps/web/src/App.tsx:102–113`.
- Estado de UI: `apps/web/src/editor/state.ts:11–44,46–97,131–160`.
- 3D: `packages/render/src/model3d/scene3d.ts:21–50,53–68,82,102–105,120–129`.
- Settings do projeto: `packages/model/src/types.ts:359–369`, `defaults.ts:138`, `migrate.ts:73`, `commands.ts:67,364`, `history.ts:196`.
- DXF: `packages/io/src/dxf.ts:87–127,208–218`.
