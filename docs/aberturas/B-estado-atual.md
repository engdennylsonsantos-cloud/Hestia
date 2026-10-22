# B · Estado atual: como o Hestia representa portas e janelas

Data: 2026-10-21. Somente leitura: nenhum código foi alterado. Caminhos relativos à raiz do repositório (`/home/user/Hestia`). "Linha" = linha do arquivo. Par: `A-pesquisa.md` (convenções de Revit, ArchiCAD e normas).

**Base da análise: commit `1be4648` (HEAD, 2026-10-20 20:54).** Durante a pesquisa a árvore de trabalho ganhou alterações não commitadas de outra rotina, sobretudo em `packages/render/src/model3d/scene3d.ts` (que passou de 303 para 355 linhas). Essas alterações não mudam a geometria das esquadrias: na função `openingObject`, só acrescentam identificação de peça para seleção (`elementId` em `userData`, e o `draw` recebe um grupo). Por isso as linhas citadas abaixo são as do HEAD. Em `packages/engine/src/section.ts`, a alteração é só de telhado (`roofId` no corte de telhado); o trecho de vãos (227-235) não mudou. Os demais arquivos de abertura citados estão iguais ao HEAD.

## 0 · Atualização (2026-10-21, esta rodada)

Este documento descreve o estado ANTES da frente de portas e janelas. O histórico (§1 a §9) fica como estava; o que mudou nesta rodada:

- **Família de abertura (novo).** `packages/model/src/opening.ts` define `OPENING_FAMILIES` (10 famílias: `door_swing`, `door_double`, `door_sliding`, `door_pivot`, `door_void`, `window_fixed`, `window_tilt`, `window_casement`, `window_sliding`, `window_void`), com `openingFamilies`, `openingFamilyOf`, `openingFamilyName`, `openingLeaves` e a regra `openingTypeIssue`, cobrada no comando `upsertOpeningType` (`packages/model/src/commands.ts`). A frente está em `docs/decisoes/0017-portas-e-janelas.md`.
- **Tipo mais rico.** `OpeningType.leaves` agora é `0|1|2|3`; `OpeningType` ganhou `code?` (Type Mark) e `description?`. `DEFAULT_OPENING_TYPES` passa a 14 tipos com código (P-01..P-06, V-01/V-02, J-01..J-07); novos: `ot_pc160` (porta de correr), `ot_pp80` (pivotante), `ot_jfixa60` (fixa), `ot_j240` (correr 3 folhas), `ot_jv120` (vão de janela). As espessuras de esquadria são campos do tipo (`frameWidth`, `frameDepth`, `leafThickness`, `glassThickness`) com padrão em `OPENING_FRAME_DEFAULTS`; `openingFrame(t, maxDepth)` limita a profundidade do batente ao NÚCLEO da parede (DEC-1: 0,14 m na `wt_alv14`, não 0,184 m).
- **Pivô corrigido (§7, L-1).** O símbolo da porta pivotante passou a ter o eixo a W/4 de uma ombreira, folha de comprimento W e arcos que chegam às duas ombreiras; o teste de símbolo agora confere pontos, não só a contagem de traços (`packages/geom/src/openingSymbol.test.ts`).
- **`double` (L-2) e janela com 0 folhas (L-3) resolvidos.** `double` é a família da porta dupla (2 folhas) e é normalizado para `swing` com 2 folhas; a janela com 0 folhas agora é só a soleira na planta E no 3D (antes discordavam).
- **3D por família.** `packages/render/src/model3d/scene3d.ts` (`openingObject`) monta porta de correr com dois painéis em faces opostas, porta dupla com dois painéis, janela de correr com n folhas em trilhos defasados, e limita o batente ao núcleo (`packages/render/src/model3d/scene3d.test.ts`).
- **Corte e elevação por família (§4 desta página).** `packages/engine/src/section.ts` carrega a esquadria por vão (`SectionEsquadria`) e `packages/render/src/section/build.ts` desenha batente, vidro, folha, linha central só na janela de correr e os símbolos de elevação (arco do maxim-ar/basculante, giro da porta, seta de correr); no corte transversal, verga e soleira com a profundidade do batente e vidro com a espessura do tipo (`packages/render/src/section/build.test.ts`).
- **DXF (L-9/X1).** O vão de corte passou a sair com o símbolo de planta, o mesmo da tela (`packages/io/src/dxf.ts`, `apps/web/src/editor/dxfExport.ts`); sem símbolo, continua retângulo (compatibilidade).
- **Quadro (L-13).** `packages/engine/src/openingSchedule.ts` + `apps/web/src/ui/dialogs/OpeningScheduleDialog.tsx` (botão em `Ribbon.tsx`, `DialogKind` `openingSchedule` em `apps/web/src/editor/state.ts`).
- **Interface.** Diálogo do tipo em seções (`OtherDialogs.tsx` + `openingTypeForm.ts`), seletor de tipo agrupado por família com busca (`OptionsBar.tsx`) e árvore de Portas/Janelas por família (`Browser.tsx`).

O que continua valendo: o mapa de arquivos (§2) e as lacunas de construção do tipo (reveal, soleira saliente, alizar, verga/contraverga, vão bruto e tolerâncias), a folha de porta sempre fechada no 3D e a exibição sempre simbólica — tudo registrado como "depois" em `docs/decisoes/0017-portas-e-janelas.md` §8. A divergência planta/3D da janela sem folha (§7) deixou de existir. Na §8, L-1, L-2, L-3, L-4, L-7, L-9 e L-13 estão resolvidos nesta rodada; L-5 (só a folha em corte/elevação e o modo aberto do 3D), L-6, L-8, L-10, L-11, L-12, L-14 e L-15 seguem abertos.

## 1. Resumo

- **Há uma única fonte do símbolo de planta.** `openingSymbolPaths` (`packages/geom/src/openingSymbol.ts:68`) gera os traços e é usada pela tela (`packages/render/src/plan/symbols.ts:9`) e pelo DXF (`apps/web/src/editor/dxfExport.ts:154`). Isso é bom: uma definição, dois destinos.
- **A planta desenha o símbolo para o vão de corte, mas o DXF desenha só retângulo.** Na tela, o vão cortado sai com o símbolo (`packages/render/src/plan/build.ts:230-241`). No DXF, o vão de corte sai como retângulo na camada `ABERTURAS` (`packages/io/src/dxf.ts:330-333`). Os dois divergem de propósito, mas a comparação "mesmo desenho nos dois" do comentário de `symbols.ts` vale só para projeção.
- **Corte e elevação desenham o vão como retângulo.** Janela leva fundo azul e uma linha vertical no meio (`packages/render/src/section/build.ts:53-67`). Porta é só um contorno, sem folha nem arco. Não há batente, caixilho, peitoril, verga nem contraverga desenhados.
- **O 3D monta o vão com caixas de largura fixa no código.** Batente de 5 cm, profundidade máxima de 9 cm, vidro de 1,2 cm, folha de 4 cm (`packages/render/src/model3d/scene3d.ts:265-275`). Nenhum desses valores vem do tipo.
- **A porta é sempre desenhada fechada no 3D.** Porta dupla vira um painel só (`scene3d.ts:275`). Não há folha aberta, soleira, alizar nem maçaneta.
- **O tipo de abertura é pobre.** `OpeningType` (`packages/model/src/types.ts:174-190`) tem largura, altura, peitoril, folhas, família de planta, materiais e fechamento. Não tem espessura de folha, perfil de caixilho, profundidade de batente, verga, alizar nem soleira.
- **Etiquetas e quadro não existem para vão.** `wallTagLabels` (`packages/render/src/plan/tags.ts:31`) só etiqueta parede. `Opening.mark` (`types.ts:192-206`) é editável em Propriedades, mas não é desenhado em nenhum lugar. Não há quadro de portas e janelas.
- **Achados de código (verificados com execução, ver §7):**
  - O arco da **porta pivotante** está geometricamente errado: termina a 7 cm do eixo, quando deveria chegar à ombreira.
  - A família **`double` é redundante**: gera exatamente o mesmo símbolo que `swing` com 2 folhas.
  - **Janela com 0 folhas** tem na planta só uma soleira tracejada, e no 3D tem caixilho e vidro. As duas vistas discordam.
  - Os testes de símbolo (`packages/render/src/plan/symbols.test.ts`) só contam traços. Nenhum teste confere a posição dos arcos, por isso o defeito do pivô passou.

## 2. Mapa de arquivos

| Arquivo | Papel | Notas |
|---|---|---|
| `packages/geom/src/openingSymbol.ts` | Símbolo de planta por família, função pura (`openingSymbolPaths`, linha 68) | Usado pela tela e pelo DXF |
| `packages/render/src/plan/symbols.ts` | Dá cor e espessura ao símbolo (`openingSymbol`, linha 9) | Traço `ink` ou `inkSoft` |
| `packages/render/src/plan/view.ts` | Classifica o vão no intervalo de vista e escolhe o estilo (`openingViewOps`, linhas 190-196) | Corte, projeção acima, projeção abaixo, além |
| `packages/render/src/plan/build.ts` | Põe os símbolos na lista de desenho (linhas 230-241) | Não desenha vão no nível grosseiro |
| `packages/engine/src/resolve.ts` | Geometria resolvida do vão (`openingGeometry`, linha 212) e furo na parede (linhas 235-237, 317-321, 343-345) | Retorno do acabamento no vão em 416-423 |
| `packages/engine/src/section.ts` | Lista de vãos do corte (`openings`, linhas 227-235 no HEAD) | Um item por vão, com `t0/t1/z0/z1` |
| `packages/render/src/section/build.ts` | Desenha o vão no corte e na elevação (linhas 53-67) | Só retângulo, fundo e linha central |
| `packages/render/src/model3d/scene3d.ts` | Peças 3D do vão (`openingObject`, linhas 248-279) | Valores fixos no código |
| `packages/render/src/plan/tags.ts` | Etiquetas de planta (`wallTagLabels`, linha 31) | Só código de parede |
| `packages/io/src/dxf.ts` | Entidades DXF do vão (`openingRect` linha 185; emissão linhas 330-337) | Corte = retângulo; projeção = símbolo |
| `apps/web/src/editor/dxfExport.ts` | Monta o `DxfOpening` com o símbolo (linhas 148-161) | Símbolo só para estados diferentes de corte |
| `packages/model/src/types.ts` | `PlanSymbol` (linha 172), `OpeningType` (174-190), `Opening` (192-206) | Modelo de dados |
| `packages/model/src/defaults.ts` | Catálogo padrão (`ot()` linha 100; `DEFAULT_OPENING_TYPES` linhas 107-117) | 9 tipos |
| `packages/engine/src/viewClass.ts` | Faixa Z do vão para o intervalo de vista (linhas 114-120) | Usa `sill` e `height` |
| `packages/engine/src/quantities.ts` | Área de vão no quantitativo de parede (linhas 62-68) | Única saída numérica de vão |
| `apps/web/src/ui/dialogs/OtherDialogs.tsx` | Diálogo do tipo de abertura (linhas 10-11 famílias; 79-98 campos) | Oferece `double` e vão livre para janela |
| `apps/web/src/ui/Properties.tsx` | Propriedades da instância (`mark` nas linhas 217 e 254; peitoril 233-237) | Peitoril com sobrescrita |

## 3. Planta: o que cada família desenha

Coordenadas: `t` ao longo da parede, `s` para a esquerda. `faceS` é a face de abertura (`sHi` se `flipFacing` é falso, senão `sLo`). `hw` é metade da largura do vão.

| Família (`plan`) | Vão | O que sai (traços) | Onde | Observação |
|---|---|---|---|---|
| (qualquer), `leaves: 0` | porta ou janela | Um traço tracejado `[6,3]` no plano médio, de `-hw` a `+hw` | `openingSymbol.ts:77-80` | Janela sem folhas sai só como isto (ver §6) |
| `swing` (1 folha) | porta | Folha `ink` (peso 1,3) de `(-hw, faceS)` a `(-hw, faceS + width)`, comprimento = largura. Arco `soft` (peso 0,7) de 90°, raio = largura, centro na dobradiça, indo para o batente oposto | `openingSymbol.ts:149-157` | Verificado (§7): raio 0,90 m, fim a 0,90 m do centro |
| `double` | porta | Igual a `swing` com 2 folhas: duas folhas de comprimento `hw`, dobradiças em `±hw`, arcos até `t = 0` | `openingSymbol.ts:149-157` | **Redundante**: `plan` não é lido. `double` com 1 folha = `swing` com 1 folha (verificado) |
| `sliding` (porta) | porta | Dois retângulos fechados de espessura `0,3 × (sHi − sLo)`, um em cada face, com sobreposição no meio; seta de 2 traços (peso 0,8) | `openingSymbol.ts:90-98`, `133-136` | O número de folhas é ignorado |
| `pivot` | porta | Anel de raio `0,2 × espessura` (12 pontos); folha do eixo `(0, sMid)` até `(0, faceS)`; arco `soft` com raio `0,5 × espessura` | `openingSymbol.ts:137-148` | **Defeito** (§7): a folha tem meia espessura e o arco não chega à ombreira |
| `fixed` | janela | Duas linhas de face (peso 1), linha do meio (0,8), duas ombreiras (1,4) | `openingSymbol.ts:100-107` | Sem nenhuma diferença entre fixa e de 1 ou 2 folhas |
| `tilt` | janela | Como `fixed`, mais um V (peso 0,8) do topo das ombreiras até o vértice no plano médio, no centro | `openingSymbol.ts:108-110` | Basculante: sem arco |
| `casement` | janela | Como `fixed`, mais um arco tracejado `[4,3]`, `soft`, 18 segmentos, flecha de `hw × 0,5`, do lado de `flipFacing` | `openingSymbol.ts:111-119` | Maxim-ar: o arco sai da face e não de uma dobradiça |
| `sliding` (janela) | janela | Como `fixed` mas sem linha do meio: duas faixas retangulares deslocadas em faces opostas, com seta | `openingSymbol.ts:100-107`, `120-121`, `90-98` | 8 traços, com 1 ou 2 folhas (verificado) |

**Furo na parede.** O vão corta a parede com um retângulo de largura `width` e espessura `thickness/2 + 0,02` para cada lado do eixo (`resolve.ts:235-237`). O retângulo de 2 cm além de cada face não afeta a área visível, porque cai fora da parede. Na planta, o corte usa `openingRect` (`resolve.ts:343-345`). Nas faixas de altura, o furo é `sill` a `sill + height` (`resolve.ts:317-321`).

**Estilo de desenho** (`plan/view.ts:190-196`):

- Corte: símbolo normal, com a espessura de corte (`paint[g.kind].cutPx`).
- Projeção acima do corte (peitoril acima do plano de corte): símbolo tracejado `[6,3]`, com espessura de projeção.
- Projeção abaixo e "além": símbolo na cor secundária (`inkSoft`), com espessura de projeção.
- Oculto: nada.

**Nível de detalhe.** No nível `coarse` o vão não é desenhado (`build.ts:229`). A regra de visibilidade está em `view.ts` (decisão 0013).

**O que a planta não desenha:** batente (marco), alizar, espessura da folha de porta (a folha é só uma linha), peitoril, soleira, verga, cota do vão, código do vão.

## 4. Corte e elevação

**Cálculo** (`packages/engine/src/section.ts:227-235`, HEAD). Para cada vão de uma parede que atravessa o plano de corte (ou que está na faixa de vista), o motor calcula a pegada `foot` (retângulo `width × thickness`) e devolve:

- `t0`, `t1`: extensão ao longo da linha de corte.
- `z0 = baseZ + sill`, `z1 = z0 + height` (altura do tipo, sem limite de altura da parede).
- `depth`: distância ao plano de corte.
- `cut`: se o plano de corte atravessa o vão.

Para a elevação, o mesmo cálculo é feito com a linha fora da construção e `depth` grande (comentário em `section.ts:15-21`).

**Desenho** (`packages/render/src/section/build.ts:53-67`):

| Elemento | Janela | Porta |
|---|---|---|
| Preenchimento | Azul `#bfe3f5`, opacidade 0,7 (corte) ou 0,55 (além) | Nenhum (o vazio mostra o papel) |
| Linha central vertical | Sempre, de `z0` a `z1`, no meio do vão (`build.ts:63-64`) | Nenhuma |
| Contorno | Peso 1,6 se `cut`, senão 1,2 (cor de tinta) | Igual |
| Folha, arco, batente, vidro | Não | Não |

**Parede em torno do vão.** A parede é cortada pela faixa de altura do furo (`resolve.ts:317-321`). A verga e o peitoril são a própria parede, com o mesmo material. Não há peça separada.

**O que o corte e a elevação não desenham:** caixilho ou batente (perfil), vidro como camada, folha de porta, arco de giro, peitoril saliente, pingadeira, verga ou contraverga, cota de peitoril e de altura.

**Achado.** A linha central da janela aparece sempre, inclusive em janela fixa de uma folha. Não tenho fonte que confirme a convenção (ver `A-pesquisa.md`, §6).

## 5. 3D

Função: `openingObject` em `packages/render/src/model3d/scene3d.ts:248-280` (HEAD). Chamada em `scene3d.ts:213`, com a base e a altura resolvidas da parede.

| Trecho | Linha | Comportamento |
|---|---|---|
| Visibilidade | 249 | Respeita a categoria oculta (`overrides[cat].visible`) |
| Vão livre de porta | 255 | Não gera peça (`kind === 'door' && leaves === 0`) |
| Altura | 257 | `min(g.height, H − sill)` |
| Batente | 265 | Largura do batente `jamb = 0,05` (fixo) |
| Profundidade | 266 | `min(espessura da parede, 0,09)` (fixo), centrado na espessura da parede |
| Ombreiras e verga | 267-269 | Três caixas, iguais para porta e janela: duas ombreiras e a verga |
| Soleira da janela | 271 | Caixa na base do vão, de altura `jamb` |
| Porta: folha | 275 | Caixa de 4 cm de espessura, largura `W − 2·jamb`, altura `h − jamb`, do piso até `h − jamb`. Mesmo material do batente |
| Janela: vidro | 272 | Caixa de 1,2 cm no centro, do material do vidro |
| Janela: montante | 273 | Caixa de 4 cm, só com 2 folhas (`leaves === 2`) |
| Posição e giro | 277-278 | Grupo no centro do vão, `z = baseZ + sill`, giro em torno de Z pela direção da parede |

**Aberturas só têm arestas nos estilos de linha** (comentário em `scene3d.ts:258`; teste em `scene3d.test.ts:198`).

**O que o 3D não tem:**

- Folha aberta de porta (todas fechadas). Não há arco de giro no 3D.
- Diferença entre porta de 1 folha e dupla (dupla = um painel de largura cheia).
- Soleira, alizar, guarnição, maçaneta, dobradiça.
- Caixilho de janela de correr, basculante ou maxim-ar (todas são caixilho fixo com vidro).
- Peitoril saliente e pingadeira.
- Espessura e material da folha separados do batente (folha usa `frameMat`).

## 6. Modelo de dados

**`PlanSymbol`** (`packages/model/src/types.ts:167-172`): `swing | double | sliding | pivot | fixed | tilt | casement`. O comentário diz "Portas: arco com folha, dupla, correr, pivotante. Janelas: fixa, basculante, maxim-ar e correr".

**`OpeningType`** (`types.ts:174-190`):

| Campo | Tipo | Uso |
|---|---|---|
| `id`, `name` | string | Identificação |
| `kind` | `door \| window` | Categoria |
| `width`, `height` | m | Vão livre (e pegada 3D) |
| `sill` | m | Peitoril padrão (0 para porta) |
| `leaves` | `0 \| 1 \| 2` | Folhas (0 = vão livre) |
| `plan` | `PlanSymbol` | Família de planta |
| `frameMaterialId`, `glassMaterialId` | id | Materiais de caixilho e vidro |
| `closure` | `inherit \| WrapMode` | Retorno do acabamento no vão (Wall Closure) |

**`Opening`** (`types.ts:192-206`): `id`, `kind` (repetido do tipo), `typeId`, `hostId`, `offset` (distância ao início da parede até o centro), `flipHand`, `flipFacing`, `sillOverride`, `mark`.

**Catálogo padrão** (`packages/model/src/defaults.ts:107-117`):

| id | Nome | Largura × altura | Peitoril | Folhas | Família |
|---|---|---|---|---|---|
| `ot_p80` | Porta 80 x 210 | 0,80 × 2,10 | 0 | 1 | swing |
| `ot_p90` | Porta 90 x 210 | 0,90 × 2,10 | 0 | 1 | swing |
| `ot_p70` | Porta 70 x 210 | 0,70 × 2,10 | 0 | 1 | swing |
| `ot_p160` | Porta dupla 160 x 210 | 1,60 × 2,10 | 0 | 2 | double |
| `ot_vao90` | Vão livre 90 x 210 | 0,90 × 2,10 | 0 | 0 | swing |
| `ot_j120` | Janela 120 x 120 | 1,20 × 1,20 | 1,10 | 2 | sliding |
| `ot_j150` | Janela 150 x 100 | 1,50 × 1,00 | 1,10 | 2 | sliding |
| `ot_j60` | Janela 60 x 60 | 0,60 × 0,60 | 1,50 | 1 | casement |
| `ot_j200` | Janela 200 x 120 | 2,00 × 1,20 | 1,00 | 2 | sliding |

Todos os tipos de porta usam `frame = mat_madeira`. Todos os de janela usam `mat_aluminio`. Todos usam `glass = mat_vidro` e `closure = inherit`. O projeto padrão usa `ot_p80` (porta) e `ot_j120` (janela) (`defaults.ts:141`).

**Diálogo do tipo** (`apps/web/src/ui/dialogs/OtherDialogs.tsx`):

- Famílias de porta (linha 10): Arco (folha), Dupla, De correr, Pivotante.
- Famílias de janela (linha 11): Fixa, Basculante, Maxim-ar (arco tracejado), De correr.
- Folhas (linhas 83-88): "Vão livre (sem folha)", 1 folha, 2 folhas. **A mesma lista vale para porta e janela.** Janela com 0 folhas é aceita pelo diálogo.

**Saídas numéricas:** `packages/engine/src/quantities.ts:62-68` (área de vão, descontada da parede). Não há quantitativo de esquadrias por tipo. `packages/engine/src/schedule.ts` só tem o quadro de paredes.

## 7. Verificações feitas

Métodos: leitura do código; execução de `openingSymbolPaths` com esbuild, em um script fora do repositório (`/tmp/claude-0/-home-user/fa79fa58-c26d-5470-9f7b-65480dd9e844/scratchpad/chk/`). Nada foi escrito no repositório.

| Caso | Resultado | Esperado | Situação |
|---|---|---|---|
| `swing`, 1 folha, `W = 0,90` | Folha de `(-0,45; 0,07)` a `(-0,45; 0,97)`, comprimento 0,90. Arco de raio 0,90 com fim em `(0,45; 0,07)` | Igual | Conforme |
| `double` = `swing`, 2 folhas, `W = 1,60` | Símbolos idênticos | `double` deveria diferir ou não existir | Redundante |
| `double` = `swing`, 1 folha | Símbolos idênticos | — | Redundante |
| `pivot`, `W = 0,90`, `t = 0,14` | Folha de `(0; 0)` a `(0; 0,07)`, comprimento 0,07. Arco de raio 0,07, de `(0; 0,07)` a `(0,07; 0)` | Folha de comprimento da ordem de `W/2` e arco que termina na ombreira `(0,45; 0)` | **Defeito** |
| `sliding` (janela), 1 folha | 8 traços | Deveria depender de folhas | Ignora `leaves` |
| Janela `fixed`, 0 folhas | 1 traço tracejado (soleira) | Vão em 3D com caixilho | Discordância com o 3D |

**Testes existentes** (`packages/render/src/plan/symbols.test.ts`): contam traços e verificam dash e fechamento. Nenhum confere pontos. O teste "famílias diferentes geram desenhos diferentes" compara `swing 1 folha`, `double 2 folhas`, `sliding` e `pivot`, e por isso não percebe a redundância de `double`.

## 8. Lacunas e defeitos

| ID | Lacuna | Evidência | Gravidade (proposta) |
|---|---|---|---|
| L-1 | Arco do pivô errado: folha de meia espessura e arco que não chega à ombreira | `openingSymbol.ts:137-148`; §7 | Alta (desenho errado) |
| L-2 | `double` não tem efeito próprio | `openingSymbol.ts:149-157`; §7 | Média (opção enganosa) |
| L-3 | Janela com 0 folhas: planta e 3D discordam | `openingSymbol.ts:77`; `scene3d.ts:255` (só porta é pulada) | Média |
| L-4 | Porta dupla no 3D é um painel só | `scene3d.ts:275` | Média |
| L-5 | Porta nunca aberta no 3D; nenhuma folha em corte ou elevação | `scene3d.ts:275`; `section/build.ts:53-67` | Média |
| L-6 | Sem batente, alizar, soleira, peitoril saliente, pingadeira e verga em nenhuma vista | §3, §4, §5 | Alta para documento de projeto |
| L-7 | Espessuras fixas no código (`0,05`, `0,09`, `0,012`, `0,04`) | `scene3d.ts:265-275` | Alta (dado fora do tipo) |
| L-8 | `OpeningType` não tem perfil de caixilho, batente, folha, verga, alizar, soleira | `types.ts:174-190` | Alta |
| L-9 | Vão de corte: símbolo na tela, retângulo no DXF | `build.ts:230-241`; `dxf.ts:330-333` | Média (conferir a intenção) |
| L-10 | DXF não tem corte nem elevação (só planta) | `dxf.ts` sem ocorrências de `section` | Informativo |
| L-11 | Linha central da janela em corte sempre desenhada | `section/build.ts:63-64` | Baixa (confirmar convenção) |
| L-12 | `Opening.mark` editável, mas não desenhado; sem etiqueta de vão | `tags.ts:31-47`; `Properties.tsx:217,254` | Média |
| L-13 | Sem quadro de portas e janelas | `engine/schedule.ts` só paredes | Média |
| L-14 | Ajuste de 2 cm no furo da planta (`+0,02`) é número mágico | `resolve.ts:236` | Baixa |
| L-15 | `kind` existe em `Opening` e em `OpeningType` (duplicado) | `types.ts:176, 194` | Baixa (risco de divergência) |
| L-16 | Janela sliding ignora `leaves` | `openingSymbol.ts:120-121` | Baixa |
| L-17 | Teste de símbolo não confere geometria | `symbols.test.ts` | Média (por isso L-1 passou) |

**Pontos que estão certos e devem ser mantidos:**

- Uma função pura (`openingSymbolPaths`) para planta e DXF.
- Estado de vista (corte, projeção acima, abaixo, além) com estilo próprio (`view.ts:190-196`).
- Furo de parede por faixas de altura (decisão 0004 #4 e 0005 #4).
- Retorno do acabamento no vão pelo tipo de parede e pelo tipo de abertura (`closure`, decisão 0005 #1).
- Arco de giro de 90° com raio igual à largura, origem na dobradiça (`swing` e `double`): confere com o critério proposto em `A-pesquisa.md`, §5.

## 9. Documentação do projeto que toca o tema

- `docs/02-MODELO-BIM.md:84-88` define porta e janela como família com tipo e instância, com "símbolo 2D (arco de giro) vindo da família".
- `docs/05-REFERENCIA-REVIT-ARCHICAD.md:48-56` e `:143`: Wall Closure é do tipo da abertura, com retorno definido por planos de referência.
- `docs/06-PROPRIEDADES-E-DIALOGOS.md:119-123` lista os campos de porta e janela (instância: peitoril, lado, inversão, marca; tipo: largura, altura, folhas, material, retorno, símbolo 2D).
- `docs/decisoes/0015-graficos-de-vista.md:21`: pesos por categoria (porta e janela 3/2) citam "NBR 6492 A.1". Não confirmei essa referência (ver `A-pesquisa.md`, §3).
- `docs/paridade/paredes.md:51-60`: D9 marca "símbolo de planta por família" como feito. D5 deixa vão em arco e formas não retangulares para a fase de famílias.
