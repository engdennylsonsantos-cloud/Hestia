# Decisão 0017 · Portas e janelas (família, tipo e instância)

Decidido em 2026-10-21 com o dono: fechar a frente de portas e janelas em três níveis — a **família** (comportamento,
símbolo de planta e folhas aceitas), o **tipo** (dimensões, código e espessuras de esquadria) e a **instância**
(posição, dobradiça, sentido, peitoril e marca). A família é o que o tipo ESCOLHE; é o contrato que dá sentido ao
símbolo de planta, ao 3D, ao corte e ao quadro. Fontes: Revit 2024 (Door/Window Type Properties, `Operation` do IFC) e
ArchiCAD 26 (Door/Window Custom Settings: `Opening Type`, `Shape`, `Floor Plan Display`). Pesquisa e estado anterior
desta frente: [docs/aberturas](../aberturas/) (`A-pesquisa.md` e `B-estado-atual.md`).

## 1 · Família: comportamento + símbolo + folhas aceitas

`packages/model/src/opening.ts` define `OPENING_FAMILIES` (10 famílias) e os helpers `openingFamilies(kind)`,
`openingFamilyOf(t)`, `openingFamilyName(t)`, `openingLeaves(t)`. A família dá o **símbolo de planta** (`plan`), o
**comportamento** (planta e 3D) e as **contagens de folhas** (`leaves`) que ela aceita. O tipo escolhe a família; a
instância não muda a família.

| Família (`id`) | Nome | Símbolo (`plan`) | Folhas | Comportamento (planta / 3D) | Par no Revit/ArchiCAD |
|---|---|---|---|---|---|
| `door_swing` | Porta de giro | `swing` | 1 | Folha de comprimento W na dobradiça e arco de 90° de raio W até a ombreira; no 3D, uma folha | Revit: porta de 1 folha. IFC `Operation`: `SINGLE_SWING_*` |
| `door_double` | Porta dupla | `double` | 2 | Duas folhas de W/2 e dois arcos até o centro; no 3D, dois painéis | Revit: porta dupla. IFC: `DOUBLE_DOOR_*` |
| `door_sliding` | Porta de correr | `sliding` | 2 | Dois retângulos fechados em faces opostas, com sobreposição e seta; no 3D, dois painéis em trilhos defasados na profundidade | Revit: porta de correr. IFC: `SLIDING_*` |
| `door_pivot` | Porta pivotante | `pivot` | 1 | Eixo a W/4 de uma ombreira, folha de comprimento W e dois arcos até as duas ombreiras; no 3D, uma folha que abre 90° no eixo a W/4 | Sem família de sistema no Revit; ArchiCAD: `Opening Type` `Double-Acting` (o mais próximo). **Mantida por decisão do dono** (§8) |
| `door_void` | Vão livre | `swing` | 0 | Duas linhas tracejadas nas faces da parede (a verga, acima do corte); no 3D, só o recorte da parede (sem folha nem caixilho) | Revit: `Opening`; ArchiCAD: vão |
| `window_fixed` | Janela fixa | `fixed` | 1 | Duas linhas de face, linha do plano médio e duas ombreiras; no 3D, caixilho e vidro | Revit: janela fixa. IFC: sem operação |
| `window_tilt` | Janela basculante | `tilt` | 1 | Como a fixa, mais um V no plano médio; no 3D, abre pelo topo como a maxim-ar por ora | Revit: basculante. IFC `Operation`: `BOTTOM_HUNG`. **Fora do catálogo por decisão do dono em 2026-10-22** (§11) |
| `window_casement` | Janela maxim-ar | `casement` | 1 | Como a fixa, mais um arco tracejado do lado de `flipFacing` | Revit: maxim-ar. IFC `Operation`: `TOP_HUNG` |
| `window_sliding` | Janela de correr | `sliding` | 2 ou 3 | n folhas em linhas defasadas, sem linha no plano médio, com seta; no 3D, n vidros em trilhos defasados | Revit: janela de correr. IFC: `SLIDING_HORIZONTAL` |
| `window_void` | Vão livre de janela | `fixed` | 0 | Duas linhas tracejadas nas faces da parede (a verga, acima do corte); no 3D, só a soleira | Revit: `Opening`; ArchiCAD: vão |

Os valores IFC são o mapeamento mais próximo do enum (`IfcDoorTypeOperationEnum` / `IfcWindowPanelOperationEnum`); quem
fixa o valor final é o exportador. O `Operation` é enum do IFC, **não** parâmetro de sistema do Revit (ver
`A-pesquisa.md` §3.1).

`openingFamilyOf` aceita duas grafias para a porta dupla: o arquivo antigo grava `plan: 'double'` e o editor pode gravar
`plan: 'swing'` com 2 folhas; as duas caem na família `door_double` (o símbolo normaliza `double` para `swing` com 2
folhas, ver `normalize` em `packages/geom/src/openingSymbol.ts`). O valor `double` continua em `PlanSymbol` só para ler
arquivos antigos.

## 2 · Tipo: dimensões, código e esquadria

`OpeningType` (`packages/model/src/types.ts`) ganhou `code?` (Revit: **Type Mark**, como `P-01`/`J-02`) e `description?`;
`leaves` passou de `0|1|2` para `OpeningLeaves = 0|1|2|3` (a janela de correr aceita 3 folhas). As espessuras de
esquadria são campos opcionais do tipo, com o padrão em `OPENING_FRAME_DEFAULTS` (`packages/model/src/defaults.ts`):
`frameWidth` 0,05 m, `frameDepth` 0,09 m, folha de porta 0,04 m, folha de janela 0,03 m, vidro 0,012 m.
`openingFrame(t, maxDepth)` resolve o valor do tipo com o padrão onde o campo falta e limita a profundidade do batente
(§4). Não houve passo novo de migração: alargar `leaves` e acrescentar campos opcionais é compatível com arquivos
antigos (o `SCHEMA_VERSION` continua 16).

`DEFAULT_OPENING_TYPES` passa a 14 tipos, com `code`: `ot_p70`/`ot_p80`/`ot_p90` (P-01..P-03), `ot_p160` (P-04),
`ot_pc160` (P-05, porta de correr), `ot_pp80` (P-06, pivotante), `ot_vao90` (V-01), `ot_j120`/`ot_j150`/`ot_j200`
(J-01/J-02/J-04), `ot_j60` (J-03), `ot_jfixa60` (J-05, fixa), `ot_j240` (J-06, correr 3 folhas), `ot_jv120` (V-02).

A **regra do tipo** é conferida ao salvar (`upsertOpeningType` em `packages/model/src/commands.ts` chama
`openingTypeIssue`): a combinação (categoria × símbolo × folhas) tem de existir em `OPENING_FAMILIES`, senão o comando
recusa com "Combinação inválida: …". O tipo é um **schema fechado**: o que não está em `OPENING_FAMILIES` não é
desenhável e por isso é recusado.

## 3 · Instância (como já era)

`Opening` não mudou: `id`, `kind`, `typeId`, `hostId`, `offset`, `flipHand` (lado da dobradiça), `flipFacing` (sentido de
abertura), `sillOverride` (peitoril por instância) e `mark`. A família é do tipo; a instância só escolhe a posição e o
lado. No Revit são os *flip controls* Hand/Facing; o Hestia já usava os dois booleanos.

## 4 · DEC-1 · batente limitado ao NÚCLEO da parede

A profundidade do batente é limitada ao **núcleo** da parede (camada de estrutura, `coreSpan(f.type)`), não à espessura
total com acabamentos. Na `wt_alv14` o núcleo tem **0,14 m** (bloco 14) e a espessura total, com reboco e tinta, é
**0,184 m**: o batente não deve ficar sob o reboco. Sem camada de estrutura, `coreSpan` devolve a espessura total.
Testes: `packages/render/src/model3d/scene3d.test.ts` (pedido de 0,20 m vira 0,14 m; nenhuma peça usa 0,184 m) e
`packages/render/src/section/build.test.ts` (C1 no corte transversal).

## 5 · X1 · símbolo no DXF

O vão de corte no DXF passou a sair com o **símbolo de planta** (a mesma função pura `openingSymbolPaths`, de
`packages/geom/src/openingSymbol.ts`, que a tela usa), na camada `ABERTURAS`; sem símbolo, continua retângulo fechado
(compatibilidade). A montagem do `DxfOpening` fica em `apps/web/src/editor/dxfExport.ts` (`dxfGeometryOf`) e a emissão em
`packages/io/src/dxf.ts`. A projeção (acima/abaixo/além) já saía com o símbolo. Testes: `packages/io/src/dxf.test.ts` e
`apps/web/src/editor/dxfExport.test.ts`.

## 6 · Corte e elevação por família (C1, C2, C5, C6, E1, E2)

`packages/engine/src/section.ts` passa a carregar, por vão, a **esquadria** (`SectionEsquadria`: família, folhas, símbolo,
largura, espessura da parede e as espessuras do tipo já limitadas ao núcleo). `packages/render/src/section/build.ts`
desenha a partir dela:

- **Vista face** (elevação e corte longitudinal, quando a projeção do vão é a largura) — batente como anel de
  `frameWidth` (ombreiras, verga e soleira), vidro na região interna, **linha central só em janela de correr** (2 ou 3
  folhas), e os símbolos: **V de giro** (decisão 0024 §2) na porta de giro, na dupla e na pivotante, e na janela de abrir
  (maxim-ar com o vértice na aresta superior; basculante, na inferior), e seta de correr na janela e na porta de correr.
  O arco tracejado do maxim-ar/basculante saiu. No grosso, nenhum símbolo.
- **Corte transversal** (a projeção é a espessura) — verga e soleira com `frameDepth` **centradas na parede** e vidro
  com `glassThickness`.
- **Vão livre** (0 folhas) — sem batente nem vidro; a janela sem folha fica só com a soleira (como no 3D), a porta sem
  folha fica só com o recorte.

Testes: `packages/render/src/section/build.test.ts`, describe "esquadria no corte e na elevação (tipo e família)".
Baselines de corte e elevação mudam de desenho (regravadas em `tests/e2e/baseline/`).

## 7 · Quadro (tabela de portas e janelas)

`packages/engine/src/openingSchedule.ts` monta a tabela: uma linha por **tipo** usado, com código (Type Mark), família,
categoria, largura, altura, peitoril, folhas, quantidade, área unitária (largura × altura) e área total; ordena portas
antes de janelas e, dentro da categoria, por código; traz totais por categoria e área; CSV com `;`, decimal com vírgula
e BOM UTF-8. O diálogo é `apps/web/src/ui/dialogs/OpeningScheduleDialog.tsx` (botão em `Ribbon.tsx`, `DialogKind`
`openingSchedule` em `apps/web/src/editor/state.ts`, rota em `App.tsx`). Testes:
`packages/engine/src/openingSchedule.test.ts`.

## 8 · Feito (acabamento de portas e janelas) e o que fica para depois

**Feito.** Todos os campos são opcionais no `OpeningType`, com padrão por leitura (`packages/model/src/openingExtras.ts`);
sem migração e sem mudar `SCHEMA_VERSION`. Padrão ausente = nada desenhado (exceto o furo, que é o vão do tipo).

- **Vão bruto (Revit: *Rough Width/Height*; ArchiCAD: *Opening Oversizes*):** `roughOversize: {w, h}` em m. O furo na
  parede cresce; a esquadria não. Vale no recorte da parede (planta, corte e 3D), no 3D e no quadro (colunas de largura
  e altura bruta).
- **Alizar (*casing*):** `casing: {width, thickness}`. Peça 3D em volta do vão nas duas faces da parede e contorno na
  elevação.
- **Peitoril saliente (*sill board*):** `sillBoard: {projection, thickness}`, só para janela. Peça no 3D, faixa sob o vão
  na elevação e projeção além das duas faces no corte transversal.
- **Verga e contraverga:** `lintel` e `sillBeam` com `{over, height}`; transpasse padrão 0,30 m e altura padrão 0,20 m.
  Peças de concreto com hachura no corte e no 3D. O quadro traz o comprimento total das peças (transpasse incluído).
- **Folha aberta no 3D:** `View3DSettings.openOpenings` (padrão fechada), com o botão "Abrir vãos" na faixa Vista. Porta
  de giro, porta dupla e porta pivotante a 90°; folhas de correr deslizando dentro do vão; maxim-ar e basculante
  abertas pelo topo (a basculante, se existir, por ora abre como a maxim-ar — ver §11).
- **Tela do acabamento (diálogo do tipo):** seção recolhível **Acabamento** em `OtherDialogs.tsx` (`OpeningTypeDialog`): folga do
  vão (largura e altura), alizar, soleira saliente (só janela), verga e contraverga. Cada peça liga e desliga: ligar grava o
  padrão (`ACABAMENTO_PADRAO`, em `openingTypeForm.ts`) e desligar tira o campo, que volta ao padrão por leitura. Medida fora
  da faixa (`ACABAMENTO_LIMITES` e `acabamentoIssue`, em `openingExtras.ts`) é recusada pelo comando `upsertOpeningType`; a
  mensagem aparece no diálogo, que continua aberto. Testes: `openingTypeForm.test.ts` (cada campo muda a peça do 3D e a linha do
  quadro) e o fluxo `tests/e2e/aberturas-acabamento.mjs` (ligar o alizar aumenta as peças do 3D).
- **Favoritos:** `ProjectSettings.favoriteOpeningTypes`, estrela no seletor de tipo (favoritos no topo da lista) e
  comando `toggleOpeningFavorite` desfazível. Lista do projeto, sem biblioteca de transferência.

**Ainda para depois.**

- **Alizar, peitoril saliente e verga na planta:** a planta não desenha essas peças (o corte da parede já usa o vão bruto).
- **Folha aberta em corte e elevação:** só o 3D abre a folha; corte e elevação seguem fechados.
- **Reveal com medida própria:** segue o retorno do acabamento pelo tipo de parede e de abertura, sem campo novo.
- **Pingadeira e soleira com cota:** não há peça nem campo.
- **Biblioteca de tipos (*Transfer Sets*):** fora do escopo; os favoritos são do projeto.
- **Exibição simbólica × projetada:** o ArchiCAD 26 tem `Floor Plan Display` `Symbolic` × `Projected`/`Overhead All`/
  `Projected with Overhead`; o Hestia sempre desenha o símbolo simbólico.
- **Porta pivotante:** mantida como família; a convenção do eixo (W/4 a partir da ombreira) continua a de
  `A-pesquisa.md` §6, agora reproduzida no 3D (§11).

## 9 · O que NÃO se copia do Revit

O Revit permite **famílias com parâmetros autorais** (o autor cria `Frame Width`, `Frame Depth`, `Glass Thickness`,
`Number of Panels` dentro da família — ver `A-pesquisa.md` §3.1). O Hestia **não** copia isso: o tipo é um schema
fechado (`openingTypeIssue`), o conjunto de famílias é fixo (`OPENING_FAMILIES`) e as espessuras são campos conhecidos do
tipo. A interoperabilidade é que segue o Revit/IFC (o `code` é o Type Mark; a família mapeia para `Operation`), não o
modelo de autoria.

## 10 · Critérios de aceitação

- Famílias: 5 de porta e 5 de janela na ordem da interface; cada tipo do catálogo cai na família do seu comportamento;
  combinação fora das famílias é recusada — `packages/model/src/opening.test.ts`.
- Tipo: `upsertOpeningType` grava o tipo válido e recusa o inválido sem alterar o projeto; o diálogo oferece só as folhas
  da família; "+ Novo tipo" cria na família escolhida — `opening.test.ts`,
  `apps/web/src/ui/dialogs/openingTypeForm.test.ts`.
- Símbolo: P1..P10 — `packages/geom/src/openingSymbol.test.ts`, `packages/render/src/plan/symbols.test.ts`.
- 3D: D1..D8, com o batente limitado ao núcleo — `packages/render/src/model3d/scene3d.test.ts`.
- Corte e elevação: C1, C2, C5, C6, E1, E2 — `packages/render/src/section/build.test.ts`.
- DXF: X1 e X2 — `packages/io/src/dxf.test.ts`, `apps/web/src/editor/dxfExport.test.ts`.
- Quadro: uma linha por tipo, portas antes de janelas, código e áreas, CSV com BOM —
  `packages/engine/src/openingSchedule.test.ts`.

## 11 · Correções de aberturas no 3D (2026-10-22)

Decisões do dono e o que passou a valer em `packages/render/src/model3d/openingParts.ts` (testes em
`openingParts.test.ts` e `scene3d.test.ts`):

- **Vidro e montantes no vão interno.** O vidro e os montantes de janela ocupam exatamente `jamb…h − jamb` (centro em
  `jamb + glassH/2`), sem fresta no topo nem invasão da soleira. O eixo da maxim-ar fica na face inferior da verga
  (`jamb + glassH`).
- **Porta de giro.** O sinal do giro considera `flipHand`; o lado em que a folha abre no 3D coincide com o arco da
  planta nas quatro combinações de `flipHand` × `flipFacing`. A porta dupla não mudou.
- **Folhas de correr.** Janela de correr (2 e 3 folhas) e porta de correr: fechadas, as folhas continuam lado a lado
  cobrindo o vão; abertas, cada folha corre no seu trilho e empilha sobre a primeira, sem passar de `±(W/2 − jamb)`
  (janela) ou do vão livre (porta) nem entrar no núcleo da parede. O montante central das janelas de correr sai do
  percurso das folhas quando abertas (fica logo depois da pilha); fechado, permanece no limite entre as folhas.
- **Porta pivotante.** Abre com "Abrir vãos": giro de 90° em torno de eixo vertical a `W/4` da ombreira do lado de
  `flipHand`, para o lado de `flipFacing`, reproduzindo a convenção do símbolo (`pivotDoor` em
  `packages/geom/src/openingSymbol.ts`): a banda curta (eixo–ombreira) abre para o lado de `flipFacing` e a longa para
  o oposto. A peça 3D mantém a largura livre das demais folhas (`W − 2·jamb`) e o estado fechado é o de antes.
- **Janela basculante fora do catálogo.** Por decisão do dono em 2026-10-22 não entra tipo `tilt` nos 14 padrões e não
  há janela de giro vertical nova. A família `window_tilt` continua em `OPENING_FAMILIES`; se existir um tipo `tilt`,
  ele abre pelo topo como a maxim-ar por ora. Isso resolve a contradição anterior entre a tabela da §1 (basculante
  `BOTTOM_HUNG`) e a linha antiga "maxim-ar e basculante abertas pelo topo": o 3D usa o topo nas duas, e a convenção de
  eixo da basculante fica para uma decisão futura.
- **Basculante e maxim-ar.** O 3D não distingue a basculante da maxim-ar enquanto não houver decisão sobre o eixo
  inferior; a dimensão das peças é a mesma fechada e aberta nos 14 tipos padrão.

## 12 · Atualização da representação técnica (OP1, 2026-10-22)

Decisão completa em [0024](0024-representacao-aberturas.md). O que muda nesta seção:

- **Giro na elevação (§6, E1).** O símbolo de giro é um V: vértice no lado da dobradiça, pontas no lado do trinco. Sai
  tracejado quando a folha abre para o observador e contínuo quando abre para o lado oposto. Convenção própria: a NBR 6492
  e a Autodesk não deram a regra.
- **Porta dupla e pivotante na elevação (§6).** Dupla: um V por folha, vértices nas ombreiras e pontas no centro. Pivotante:
  eixo a W/4 com o vértice do V sobre ele.
- **Vão livre sem X, furos com X (0024 §3, revisada em 2026-10-24).** O vão livre de parede não leva X em nenhuma vista:
  na planta, a parede interrompida e duas linhas tracejadas nas faces (como o vão vazio do ArchiCAD); no corte e na
  elevação, só o contorno. Furo quadrangular de piso e laje leva o X na planta, que segue a categoria do elemento e não
  aparece no grosseiro.
- **Pivotante (§8).** A posição do eixo continua provisória (W/4), sem fonte oficial.
