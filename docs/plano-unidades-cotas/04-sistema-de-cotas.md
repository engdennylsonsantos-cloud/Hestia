# Fase E: sistema único de cotas dinâmicas e referências

Pré-requisitos: Fase A (formatação/entrada), Fase D (batente e prévia real). Leia antes: `docs/aberturas/pesquisa-f0/R7-revit-cotas-temporarias.md` e `docs/PENDENCIAS-2026-10-28-cotas-padroes-esquadrias.md` (seção A).

## 1. Objetivo
Um **único** sistema para cotas dinâmicas ("cotas temporárias"), usado por todas as ferramentas e pela seleção:
- aparece **ao colocar/desenhar** (prévia) e **ao selecionar** um elemento;
- mede até a **referência escolhida** (eixo / face acabada / núcleo / face do núcleo; para esquadrias: centro / vão livre / vão externo do batente / com alizar);
- clicar no valor, digitar e Enter **reposiciona** o elemento; elemento hospedado **não sai da parede** (alerta);
- clicar na **alça** (ponta da linha de chamada) alterna a referência daquela ponta;
- o ícone **I** converte as cotas em **cotas permanentes**;
- a configuração padrão fica em **Padrões do projeto → Cotas…**;
- adicionar a cota a uma ferramenta nova = **escrever um provedor pequeno e registrá-lo** (ver D11).

## 2. Vocabulário único (substitui os 3 atuais)
```ts
// packages/model/src/dimensionSettings.ts
export type WallDimRef = 'axis' | 'finish' | 'coreCenter' | 'coreFace';
//  axis       = eixo da parede (centro da espessura total)
//  finish     = face acabada (a face de fora da parede voltada para o elemento medido)
//  coreCenter = eixo do núcleo
//  coreFace   = face do núcleo (a voltada para o elemento medido)
export type OpeningDimRef = 'center' | 'clear' | 'frame' | 'casing';
//  center = centro do vão
//  clear  = vão livre (luz): entre as faces internas do batente
//  frame  = vão externo do batente
//  casing = com alizar (borda externa do alizar do lado onde a cota é desenhada)
export interface DimensionSettings { wallRef?: WallDimRef; openingRef?: OpeningDimRef; showOnPlacement?: boolean; showOnSelection?: boolean }
export interface ResolvedDimensionSettings { wallRef: WallDimRef; openingRef: OpeningDimRef; showOnPlacement: boolean; showOnSelection: boolean }
```
Padrões: `wallRef 'finish'`, `openingRef 'frame'`, `showOnPlacement true`, `showOnSelection true`.
"Face voltada para o elemento medido" = a face do plano de parede que fica do lado de onde se mede (entre a parede e o elemento).
Mapeamento dos vocabulários antigos: `axis`→`wallRef 'axis'` + `openingRef 'center'`; `face`→`wallRef 'finish'` + `openingRef 'frame'`; `autoCotas`: `ReferenciaParede 'externa'→'finish'`, `'nucleo'→'coreFace'`, `'eixo'→'axis'`; `modoAberturas 'centro'→'center'`, `'arestas'→'frame'` (**confirme lendo `autoCotas.ts`** o que cada um mede de fato e ajuste o mapeamento se divergir; anote em `PROGRESSO.md`).

## 3. Arquitetura (arquivos novos)
```
packages/model/src/dimensionSettings.ts        tipos acima + dimensionSettingsOf(p) (leitura com padrões, memoizado)
packages/engine/src/wallPlanes.ts              planos de uma parede (eixo, faces acabadas, núcleo) nas duas direções
packages/engine/src/openingExtents.ts          meias-larguras da abertura por referência
packages/tools/src/dims/types.ts               TempDim, DimEnd, DimEditResult, DimContext, DimProvider
packages/tools/src/dims/refs.ts                resolvedores puros (planos de vizinhas × referência × lado)
packages/tools/src/dims/registry.ts            registerDimProvider / selectionDims / dimsForTool
packages/tools/src/dims/validate.ts            validação de elementos hospedados (sem sair da parede)
packages/tools/src/dims/providers/*.ts         opening, wall, line, grid, outline, displacement
packages/tools/src/dims/permanent.ts           TempDim[] → comandos de cotas permanentes
apps/web/src/ui/dims/TempDimsOverlay.tsx       componente único (SVG + campos), alças, I, alerta
apps/web/src/ui/dims/useSelectionDims.ts       hook
apps/web/src/ui/dialogs/DimensionSettingsDialog.tsx  diálogo "Cotas…"
```
Camadas: `engine` não conhece `tools`; `tools` não conhece React; o overlay só desenha e chama `edit`.

### Tipos centrais (`dims/types.ts`)
```ts
export interface DimEnd {
  at: Vec2;                                   // ponto medido (mundo)
  slot: string;                               // 'left' | 'right' | 'a' | 'b' ...: identifica a ponta
  kind: 'wall' | 'opening';                   // qual vocabulário vale nesta ponta
  current: WallDimRef | OpeningDimRef;        // referência em uso
  options: ReadonlyArray<WallDimRef | OpeningDimRef>;  // as que esta ponta aceita
}
export type DimEditResult = { commands: Command[]; note?: string } | { error: string };
export interface TempDim {
  key: string;                    // estável entre quadros: `${provider}:${subjectId}:${slot}`
  a: Vec2; b: Vec2;               // pontos medidos
  offset: number;                 // afastamento da linha de cota (m, lado esquerdo de a→b; negativo = direito)
  value: number;                  // metros
  ends: [DimEnd, DimEnd];
  tone?: 'valid' | 'invalid';
  edit?: (valueSI: number) => DimEditResult;   // ausente = só leitura
}
export interface DimContext {
  project: Project; levelId: Id;
  settings: ResolvedDimensionSettings;
  overrides: Readonly<Record<string, WallDimRef | OpeningDimRef>>;  // `${providerId}:${slot}` → referência escolhida na sessão
}
export interface DimProvider<S> { id: string; compute(ctx: DimContext, subject: S): TempDim[] }
```
`edit` é **pura**: devolve comandos, não os executa. O overlay executa (um passo de desfazer) ou mostra o erro.

## 4. Passos

### D0: mapa do que existe (sem código de produção)
Crie `docs/plano-unidades-cotas/mapa-cotas.md` com: onde cada coisa é calculada, desenhada e editada hoje. No mínimo: `packages/tools/src/openingPlacement.ts` (`dimensionRefs`, `temporaryDimensions`, `perpendicularNeighbors`), `openingDims.ts`, `openingTool.ts`, `apps/web/src/ui/OpeningTempDims.tsx`, `ViewportOverlays.tsx`, `PlacementProperties.tsx` (select "Cotas"), `ToolOptions.openingDimMode` (tools/types.ts), `state.ts`, `packages/engine/src/autoCotas.ts`, `packages/tools/src/dimensionTool.ts`, `lengthEdit.ts`, `selectGrips.ts`, `outlineEdit.ts`, `wallTool.ts`, `detailLineTool.ts`, `gridTool.ts`, `perimeterTool.ts`, `transformTools.ts`, `floorTool.ts`/`slabTool.ts`/`roofTool.ts`/`ceilingTool.ts`, `base.ts` (interface `Tool`), `model/src/dimension.ts` (`dimensionGeometry` já devolve linha, chamadas, tracinhos e posição do texto: **reaproveite**). Anote também: existe função pura para aplicar comando a uma cópia do projeto? (`grep -n "export function apply" packages/model/src/commands.ts`). Commit: `docs(cotas): D0 mapa do sistema atual`.

### D1: configuração no modelo
1. `dimensionSettings.ts` (tipos da seção 2, `dimensionSettingsOf(p)` memoizado por identidade de `p.settings?.dimensions`, mesma referência padrão quando ausente). Exportar em `index.ts`.
2. `types.ts`: `ProjectSettings.dimensions?: DimensionSettings` (sem mexer em `SCHEMA_VERSION`; `createEmptyProject` não grava).
3. Testes: padrões; parcial; `setSettings` com `dimensions` + desfazer/refazer; JSON ida e volta.
Commit: `feat(cotas): D1 configuração de referências em ProjectSettings`.

### D2: planos de parede e extensões da abertura (engine)
**Leia** `packages/engine/src/frame.ts` (`WallFrame`: `sExt`, `sInt`, `sMid`, `sHi`, `sLo`, `thickness`, `extOffset`; `exteriorOffset`, `totalThickness`, `coreSpan`) e `openingModelContext.ts`.
1. `wallPlanes.ts`:
```ts
export interface WallPlanes { axis: number; faceLo: number; faceHi: number; coreLo: number; coreHi: number; coreCenter: number } // coordenadas na normal da parede (mesma convenção de frame.sLo/sHi)
export function wallPlanes(frame: WallFrame): WallPlanes;
/** Posição (na normal) do plano `ref` voltado para o lado `toward` (+1 = lado de n, -1 = oposto). axis e coreCenter ignoram `toward`. */
export function wallPlaneAt(planes: WallPlanes, ref: WallDimRef, toward: 1 | -1): number;
```
Teste com parede de 1 camada (núcleo = total), de 3 camadas assimétricas (revestimento de 2 cm só de um lado, núcleo 14 cm) e com linha de localização diferente (`finishExterior`, `coreCenter`).
2. `openingExtents.ts`:
```ts
export interface OpeningExtents { center: 0; clear: number; frame: number; casing: number }   // meias-larguras a partir do centro, em m
export function openingExtents(p: Project, opening: Pick<Opening,'typeId'|'hostId'|'flipFacing'|...>, frame: WallFrame, face: 1 | -1): OpeningExtents;
export function openingEdge(ext: OpeningExtents, ref: OpeningDimRef): number; // meia-largura da referência
```
Calcule a partir do **modelo real** (`compositionOfType`, largura do batente/peças `frame`, alizar `casing` da face `face`; **leia** `openingComposition.ts`, `openingModelCasing.ts`). Garantias testadas: `0 < clear ≤ frame ≤ casing`; sem alizar → `casing === frame`; porta com bandeira lateral: `frame` cobre o conjunto inteiro (vão externo do conjunto, não só da folha); `frame` coincide com a largura do recorte da parede (**verifique** com `buildOpeningModel`/`openingGeometry` e registre em `PROGRESSO.md` a relação; se o recorte for outro valor, ajuste o padrão `openingRef` em D1 para a referência que coincide com o recorte).
Commit: `feat(cotas): D2 wallPlanes e openingExtents`.

### D3: resolvedores puros (tools)
`dims/refs.ts` generaliza `perpendicularNeighbors` (hoje `axisT/faceLo/faceHi`) e `dimensionRefs`:
```ts
export interface HostTarget { t: number; ownerId: Id | null; kind: 'wall' | 'end' }  // t ao longo do hospedeiro
/** Alvos à esquerda e à direita de `t0` para a referência de parede escolhida. Sem vizinha: extremidade do hospedeiro (kind 'end'). */
export function hostTargets(project: Project, host: WallFrame, t0: number, ref: WallDimRef): { left: HostTarget; right: HostTarget };
```
- Vizinhas = paredes do mesmo nível que cruzam o hospedeiro em ângulo (reuse a detecção de `perpendicularNeighbors`; **estenda-a** para devolver o `WallFrame` da vizinha, de onde saem os planos por `wallPlanes`). O plano `t` da vizinha para a referência `ref`: use `wallPlaneAt` na vizinha e projete no eixo do hospedeiro (para vizinhas não exatamente perpendiculares, projete o ponto de cruzamento do plano com o eixo do hospedeiro).
- Paredes curvas (hospedeiro com `arc`): `t` é comprimento de arco; aceite apenas vizinhas cuja interseção caiba; se não houver solução confiável, devolva só as extremidades. Teste.
Testes: cruzamento em T e em L, vizinha com 3 camadas, `ref` em cada um dos 4 valores, sem vizinha, abertura próxima à ponta, hospedeiro curvo.
Commit: `feat(cotas): D3 resolvedores de referência`.

### D4: provedor da esquadria, registro e colocação
1. `dims/registry.ts`: `registerDimProvider(kind: ElementKind, provider)`, `selectionDims(ctx, ids: Id[]): TempDim[]` (só com **um** elemento selecionado e provedor registrado; `showOnSelection` falso → `[]`), `getProvider(kind)`. Registro explícito em `dims/providers/index.ts` (importado por `packages/tools/src/index.ts`), **sem efeito colateral de importação escondido**: exporte `registerBuiltinDimProviders()` e chame-a na inicialização do pacote (leia como `registry.ts` das ferramentas faz).
2. `providers/opening.ts`:
```ts
export interface OpeningDimSubject { hostId: Id; offset: number; typeId: Id; flipFacing: boolean; id?: Id /* ausente na colocação */; side: 1 | -1 /* lado da planta em que as cotas são desenhadas */ }
```
`compute` devolve **2 cotas** (esquerda e direita): da referência de parede (`hostTargets` com `ctx.settings.wallRef`, ou override `opening:left`/`opening:right`) até a referência da esquadria (`openingEdge` com `openingRef`, override idem). Valor = distância ao longo do hospedeiro. `ends[0]` (parede) com `kind:'wall'`, `ends[1]` (esquadria) com `kind:'opening'`, cada uma com as `options` completas.
`edit(v)`: novo `offset` = alvo ± (v + meia-largura da referência) (esquerda: `t_alvo + v + edge`; direita: `t_alvo − v − edge`); reutilize e **generalize** a validação de `editOpeningDim` (sobreposição com outras esquadrias via `occupiedRanges`, **dentro** do comprimento do hospedeiro, não atravessar perpendicular — o recorte, isto é `frame`, não pode invadir a vizinha). Falhas: `{ error: 'A porta P-01 sairia da parede.' }`, `'Sobrepõe a janela J-02.'`, `'Atravessa a parede perpendicular.'`. Sucesso: `{ commands: [{ type:'updateElements', ids:[id], patch:{ offset } }] }`.
3. `openingTool.ts`: remova `temporaryDimensions`/`formatMeters` da prévia; a ferramenta passa a expor `tempDims(): TempDim[]` (ver D5) calculado com o provedor e o `OpeningDimSubject` da prévia (`side` = `lastSide`). `openingPlacement.ts` perde `dimensionRefs`/`temporaryDimensions`/`TemporaryDimension`; `openingDims.ts` e seus testes migram para os testes do provedor e são apagados. Mantenha `perpendicularNeighbors`/`freeSpans`/`occupiedRanges` se ainda usados (ou mova-os para `dims/refs.ts`).
4. Testes (`providers/opening.test.ts`): valores nas 4×4 combinações wallRef×openingRef num caso numérico fixo calculado à mão no próprio teste; `edit` válido (posição final correta), fora da parede, sobreposto, sem vizinha; porta com bandeira lateral usa `frame` do conjunto; override de ponta.
Commit: `feat(cotas): D4 provedor de esquadrias e registro`.

### D5: componente único de exibição
`apps/web/src/ui/dims/TempDimsOverlay.tsx` substitui `OpeningTempDims.tsx` (apague-o e ajuste `ViewportOverlays.tsx`).
- Fonte dos dados: se há ferramenta ativa diferente de Selecionar e ela implementa `tempDims?()` (acrescente à interface `Tool` em `packages/tools/src/base.ts` como método **opcional**), usa a prévia; senão `useSelectionDims()`.
- Geometria visual: use `dimensionGeometry(a, b, offset, mPerMm)` do `model` (já devolve linha, linhas de chamada, tracinhos e `textAt`). `mPerMm` = `metersPerPixel * 3.78` (tamanho de tela fixo, independente do zoom). Desenhe num `<svg>` sobreposto (posição pelo `worldToScreen` do viewport, como o `OpeningTempDims` faz) com tom azul (`var(--accent)`), tracejado fino para linhas de chamada.
- Texto: `<input>` na posição `textAt`, valor por `useFormat()('length', value, { withUnit: false, trim: true })`, `aria-label="Cota: <slot>"`. Clique/foco abre edição; Enter → `parseQuantityText` → `dim.edit(si)`; sucesso executa os `commands` em **uma** transação (`editor.store.transaction`/`exec` como os outros overlays) e atualiza status; erro → `useUi` `status` + destaque vermelho da cota por 4 s (estado local do overlay com um único `setTimeout` limpo no cleanup do efeito: é feedback efêmero de UI, permitido). Esc cancela. Eventos de ponteiro param no overlay (`stop`), como em `OpeningFlipGrips`.
- Pontas (D7) e botão "I" (D8) ficam no mesmo componente (linhas de código pequenas; se passar de 420 linhas, divida em `DimEndGrip.tsx`, `DimText.tsx`).
- Hook `useSelectionDims.ts`: assina projeto, seleção, `previewTick`, `dimOverrides` e configuração; `useMemo` para não recalcular sem mudança.
- Estado novo em `apps/web/src/editor/state.ts`: `dimOverrides: Record<string, WallDimRef | OpeningDimRef>` (+ ação `setDimOverride(key, ref)` e `clearDimOverrides()` chamada ao trocar de ferramenta e no Esc).
Testes: lógica pura em `dims/dimsView.ts` (posições/clamps/estado de edição) testada sem DOM; componente: renderiza duas cotas para a porta selecionada; digitar e Enter emite `updateElements`; valor inválido não grava; erro mostra alerta.
Commit: `feat(cotas): D5 sobreposição única de cotas dinâmicas`.

### D6: edição + validação de hospedados
`dims/validate.ts`:
```ts
export function hostedConflicts(project: Project, wallId: Id, next: { length?: number; startShift?: number }): string | null; // mensagem ou null
```
Regras: ao encurtar/mover uma parede, cada esquadria hospedada deve continuar com `[offset − frame/2, offset + frame/2]` dentro de `[0, novoComprimento]` (após aplicar `startShift`); se alguma sair → `'A porta P-01 sairia da parede. Mova ou apague a esquadria antes.'` e **nenhum** comando é emitido. Esquadrias adjacentes não podem se sobrepor depois do ajuste.
Use em todos os provedores que alteram paredes (D10). Teste: encurtar parede com porta na ponta falha; com folga passa; mover a parede inteira não altera `offset`.
Commit: `feat(cotas): D6 validação de hospedados`.

### D7: alças das pontas (trocar a referência)
No overlay, cada `DimEnd` vira uma alça (círculo azul de 10 px na ponta da linha de chamada, `aria-label="Referência: <rótulo>"`). Clique → próxima de `options` (cíclico) → `setDimOverride(`${provider}:${slot}`, ref)`; o provedor lê `ctx.overrides` e a cota recalcula na hora. Dica (`title`) com a referência atual por extenso: "Eixo", "Face acabada", "Eixo do núcleo", "Face do núcleo", "Centro", "Vão livre", "Vão externo do batente", "Com alizar". Teste: clicar 4 vezes volta à referência original e os valores mudam conforme o esperado.
Commit: `feat(cotas): D7 alças trocam a referência`.

### D8: converter em cota permanente ("I") e `autoCotas`
1. `dims/permanent.ts`: `toPermanent(ctx, dims: TempDim[]): Command[]` — um `addDimension` (verifique o nome real do comando em `model/commands.ts` e como `dimensionTool.ts` cria cotas) por `TempDim`, com `a`, `b`, `offset` e `mode` coerentes; sem `unit`/`precision` (seguem o projeto). Se a ponta for extremidade de parede, grave `refs` (`DimensionRef`) como o `dimensionTool` faz.
2. Overlay: botão "I" (`aria-label="Converter em cotas permanentes"`) ao lado do grupo; executa `toPermanent` numa transação; status "Cotas criadas.".
3. `autoCotas.ts`: `AutoCotaOptions` ganha `wallRef?: WallDimRef` e `openingRef?: OpeningDimRef` (padrão: `dimensionSettingsOf(p)`); `referenciaParede`/`modoAberturas` ficam como apelidos **obsoletos** mapeados (seção 2). Resolva os planos com `wallPlanes`/`openingExtents` (uma só regra). Interface de cotas automáticas (procure `cotasAutomaticas` em `apps/web`) usa o vocabulário novo.
Testes: `toPermanent` gera comandos esperados; `autoCotas` com cada `wallRef` produz as distâncias esperadas num caso fixo; opções antigas continuam produzindo o mesmo resultado de antes (teste de regressão com o mapeamento).
Commit: `feat(cotas): D8 cotas permanentes e autoCotas unificado`.

### D9: diálogo "Cotas…" e troca rápida
1. `DialogKind` ganha `'dimensions'`; `DimensionSettingsDialog.tsx` (mesmo padrão do `UnitsDialog`): "Referência de paredes" (4 opções por extenso), "Referência de portas e janelas" (4), caixas "Mostrar ao colocar" e "Mostrar ao selecionar", **Restaurar padrões**; confirmar emite `setSettings { dimensions }` (um passo de desfazer). Botão **"Cotas…"** ao lado de "Unidades…" em Padrões do projeto (`Properties.tsx`).
2. Troca rápida: substitua o select "Cotas" de `PlacementProperties.tsx` (que usa `openingDimMode`) por dois selects ("Parede", "Esquadria") que alteram **só a sessão** (`dimOverrides` com chaves de referência global `opening:*`) com opção "Padrão do projeto". Remova `ToolOptions.openingDimMode` (`tools/types.ts`) e o padrão em `state.ts`; ajuste testes.
Testes: modelo do diálogo (rascunho ↔ settings), componente (abre, grava, desfaz), troca rápida altera o resultado do provedor sem gravar no projeto.
Commit: `feat(cotas): D9 diálogo Cotas… e troca rápida`.

### D10: demais provedores e integração nas ferramentas
Para **cada** provedor: arquivo em `dims/providers/`, registro, teste do `compute` e do `edit`, e integração com a ferramenta correspondente (`tempDims()` na prévia e/ou `registerDimProvider` para seleção). Em todos, leia o código vizinho antes e **reutilize** as funções existentes de edição (`lengthEdit.ts`, `selectGrips.ts`, `outlineEdit.ts`, comando de mover); não duplique regra.
1. **wall.ts** — *seleção*: (a) comprimento da parede (edit: move a extremidade `b` mantendo `a`, ou o que `lengthEdit.ts` já faz; valida com D6); (b) distância perpendicular até a parede paralela mais próxima de cada lado, medida entre `wallRef` da parede e `wallRef` da vizinha (edit: translada a parede na normal, reutilizando o comando de mover; hospedados acompanham). *Colocação* (`wallTool.ts`): comprimento do segmento em desenho e, quando houver parede paralela próxima, a distância a ela.
2. **line.ts** — linhas de detalhe (`detailLineTool.ts`): comprimento ao desenhar e ao selecionar; **modo perímetro** (`perimeterTool.ts`/`perimeterSession.ts`): comprimento do lado em desenho e, ao selecionar, de cada lado do contorno (edit só onde a sessão já aceita digitar comprimento; leia `perimeterToolInput.ts`).
3. **grid.ts** — eixos/grades (`gridTool.ts`, `gridGeom.ts`): ao selecionar, distância às grades paralelas vizinhas dos dois lados (edit: move a grade; verifique a regra de alinhamento/eixos existente em `gridUi.ts`).
4. **outline.ts** — piso, laje, telhado, forro (`floorTool`, `slabTool`, `roofTool`, `ceilingTool`, `outlineEdit.ts`): ao desenhar, comprimento do lado atual e fechamento; ao selecionar, comprimento de cada lado (somente leitura se `outlineEdit.ts` não oferece função pura para alterar o comprimento de um lado; se oferecer, editável).
5. **displacement.ts** — mover/copiar (`transformTools.ts`): durante o gesto, cota do deslocamento (distância e ângulo) do ponto-base ao cursor; digitar o valor já existe nessas ferramentas: a cota apenas o exibe com o mesmo `parseQuantityText`.
6. Pendente de decisão do dono (**não implemente**, só liste em `PROGRESSO.md` como possível extensão): escadas, ambientes, seções.
Cada integração: um commit (`feat(cotas): D10.<n> <provedor>`). Para cada uma, teste de ferramenta: preview contém a cota esperada (`tempDims()`), e a seleção devolve a cota.

### D11: documentação de reaproveitamento e aceite
1. `docs/plano-unidades-cotas/COMO-ADICIONAR-COTA.md` (máx. 60 linhas): passo a passo + exemplo completo de um provedor mínimo (≤ 25 linhas) que mede o comprimento de um elemento hipotético, com teste. Coloque o exemplo também como teste (`dims/providers/example.test.ts`) para que a doc nunca fique desatualizada.
2. `docs/decisoes/`: decisão "Sistema de cotas dinâmicas e referências" (formato dos vizinhos).
3. **Critério de aceite da reutilização**: o teste do exemplo prova que registrar um provedor novo exige apenas: tipo do sujeito, `compute`, `edit` opcional e uma linha de registro. Se exigir mexer no overlay, a arquitetura falhou: refatore.

## 5. Critérios de aceite da fase
- Nenhum uso restante de `openingDimMode`, `temporaryDimensions`, `dimensionRefs`, `OpeningTempDims`, `editOpeningDim`, `OpeningDimMode` (`grep` retorna vazio).
- Porta/janela: ao colocar e ao selecionar aparecem 2 cotas; mudar `wallRef`/`openingRef` no diálogo ou na alça muda os valores; digitar move; fora da parede dá alerta e nada muda.
- Parede, linha, perímetro, eixo, piso/laje/telhado e mover/copiar mostram cotas conforme D10.
- "I" cria cotas permanentes com o mesmo valor mostrado; desfazer remove tudo de uma vez.
- Unidades do projeto (Fase A) afetam todos os valores mostrados e aceitos nas cotas (teste com `length: cm` e `ft-in`).
- `npm run check` verde; sem arquivo > 420 linhas.
