# E · Especificação: modelo único da esquadria (v2)

Data: 2026-10-26. Dono: decisões em [0034](../decisoes/0034-esquadrias-v2.md). Contexto: [D](D-editor-esquadrias-revit-archicad.md) (pesquisa e proposta) e [0017](../decisoes/0017-portas-e-janelas.md). Referência visual (só UX, tem defeitos conhecidos): [prototipo-editor-esquadrias.html](prototipo-editor-esquadrias.html).

## 0 · Regra de ouro

Existe **uma** função que calcula as peças da esquadria: `buildOpeningModel` (`packages/engine/src/openingModel.ts`). Planta, corte, elevação, 3D, DXF e a prévia do diálogo **só desenham as peças que ela devolve**. É proibido uma vista recalcular posição de batente, folha, vidro, maçaneta, alizar, verga ou peitoril. Se faltar uma peça, a correção é no modelo, não na vista.

Tipos: `packages/engine/src/openingModelTypes.ts` (já existe; ler antes de tudo). Campos novos do tipo: `OpeningType` em `packages/model/src/types.ts` (bloco "Esquadria v2"); convenção da linha de abertura: `ProjectSettings.openingLine`.

## 1 · Convenções (valem para todo o código)

- **Coordenadas locais do vão** `(t, s, z)`: ver o cabeçalho de `openingModelTypes.ts`. `s = 0` é o plano médio da parede; faces em `±thickness/2`; `+s` é o lado de `n`.
- **Dobradiça** (`Opening.flipHand`): `false` → dobradiça no lado `t < 0` (`h = −1`); `true` → `t > 0` (`h = +1`). A posição da dobradiça é configurável pelo usuário (instância, e padrão no tipo para novas inserções); o lado do trinco é sempre o oposto.
- **Sentido de abertura** (`Opening.flipFacing`): `false` → a folha abre para `+s`; `true` → para `−s`. `side = flipFacing ? −1 : +1`.
- **Núcleo**: o batente se assenta no núcleo da parede (`coreSpan`, DEC-1), que o modelo converte para `core: {s0, s1}` em `s` local. `s` de uma distância `d` medida da face externa: `s = sExt + sign(sInt − sExt)·d − sMid`.
- **Observador das elevações**: a elevação é vista de um lado da parede, `viewSide = +1` (observador no lado de `n`) ou `−1`. Para o observador em `viewSide`, a coordenada horizontal da tela é `x = −viewSide · t` (observador em `+n` olhando para `−n` vê `+t` à esquerda). A folha abre **para o observador** quando `opening.side === viewSide`.
- **Convenção da linha de abertura (V), decidida pelo dono**: o **vértice do V fica no lado OPOSTO ao da dobradiça** (lado do trinco) e as duas pontas vão para o lado da dobradiça, nos cantos superior e inferior da folha. Configurável em `ProjectSettings.openingLine.apex` (`'latch'` padrão, `'hinge'` inverte). Traço: tracejado quando a folha abre **para** o observador, contínuo quando abre para longe; configurável em `openingLine.dashed` (`'toward'` padrão, `'away'` inverte). Janela maxim-ar: vértice na aresta oposta ao eixo (embaixo), pontas no eixo (em cima); basculante, o contrário. A mesma função (`openingLinePaths`, a criar pelo agente S) serve elevação, corte e 3D-linhas.
- **Folha fixa não tem linha de abertura.** Bandeira superior e bandeiras laterais são fixas por padrão (`transom.fixed !== false`): nenhuma linha de projeção nelas.
- Unidades: metros. Ângulos: radianos no código, graus nos campos do tipo.

## 2 · API do modelo (agente K)

```ts
buildOpeningModel(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): OpeningModel
partTransformed(part: OpeningPart, state: OpenState): OrientedBox   // caixa orientada (4/8 vértices) após o movimento
slicePartsAtZ(m: OpeningModel, z: number, state: OpenState): Array<{ part: OpeningPart; ring: Array<{t:number; s:number}> }>
projectParts(m: OpeningModel, axis: 's' | 't', state: OpenState): Array<{ part: OpeningPart; ring: Array<{u:number; z:number}>; depth: number }>
openingLinePaths(...)   // V de abertura (agente S), usa m.openings
```

`OpenState.angle`: 2D = `type.angle2d ?? 90°`; 3D = `type.angle3d ?? família` (porta de giro 90°; maxim-ar/basculante 30°). A fração de correr: `slide = 1` é totalmente aberta. Estado fechado: `CLOSED`.

## 3 · Geometria de repouso (agente K) — famílias existentes

Símbolos: `J = frameWidth`, `D = frameDepth` (já limitada ao núcleo), `L = leafThickness`, `G = glassThickness`, `ov = 0,015` (largura do batedor), `gap = 0,004` (folga), `W/H` = largura e altura nominais do tipo, `hw = W/2`, `C = (core.s0 + core.s1)/2`. Todas as peças ficam dentro do vão: `|t| ≤ hw`, `0 ≤ z ≤ H` (exceto alizar, peitoril saliente, contraverga, verga, que ficam fora do vão por definição).

### 3.1 Porta de giro (1 folha), batente `frameStyle = 'rebate'` (padrão)

- Ombreira de cada lado `j = ±1`, **duas caixas**: corpo `t ∈ [j·(hw − J + ov), j·hw]` (ordenado), `s ∈ [C − D/2, C + D/2]`, `z ∈ [0, H]`; batedor `t ∈ [j·(hw − J), j·(hw − J + ov)]`, profundidade só do lado **oposto** ao da abertura: `s ∈ [C − side·D/2 … C − side·D/2 + side·(D − (L + 0,004))]` (ordenado), mesma altura.
- Travessa `head`: `t ∈ [−hw, hw]`, `z ∈ [H − J, H]`, `s` do corpo; com o batedor na parte inferior, igual às ombreiras.
- **Folha**: meia-largura `lh = hw − J + ov − gap` (largura útil `2·lh`); `z ∈ [0,008, H − J + ov − gap]`; espessura `L` em `s ∈ [sStop, sStop + side·L]` onde `sStop = C + side·(D/2 − (L + 0,004))`. Com `leafSide = 'opposite'`, o espelho disso. A folha fica **apoiada no batedor**: nunca atravessa o batedor nem o corpo (testar interseção).
- **Dobradiça**: `hingeT = h · lh`, `hingeS` = plano médio da folha; movimento `rotate axis 'z'` em (hingeT, hingeS), `sign = side · (h < 0 ? +1 : −1)` de modo que ângulo positivo leve a folha para `side`. `LeafOpening.radius = 2·lh`; `latchT = −h·lh`.
- **Sem batente (`'block'`)**: nenhuma peça de batente; a folha preenche `|t| ≤ hw − gap` e articula em `±(hw − gap)`.
- `'simple'`: ombreira de caixa única `J × D`, sem batedor; folha centrada em `C`. `'aduela'`: como `'rebate'` com `J = 0,03` e `D` = núcleo inteiro.

### 3.2 Porta dupla, pivotante, correr, vão livre

- **Dupla**: duas folhas com a mesma regra, `2·lh` dividido: cada folha tem largura `lh − 0,002`; dobradiças em `±lh`; as duas giram para `side`.
- **Pivotante**: uma folha de largura `2·lh`, eixo vertical em `t = h · (hw/2)` (a `W/4` da ombreira da dobradiça, provisório, 0017 §8); a folha gira inteira em torno do eixo; ao abrir, a banda curta vai para `side` e a longa para o oposto. `radius = 3·hw/2`.
- **Correr (2 folhas)**: batente sem batedor (`J × D`), trilhos `track` (metal) no `head` e no piso; duas folhas em **pistas** `s = C ± (L/2 + 0,003)`, cada uma com largura `(2·(hw − J) + 0,06)/2`, sobrepostas no centro; `flipHand = true` troca qual corre. `motion = slide` com `travel = largura da folha − 0,06`, direção `±t` para a folha móvel; a outra fica parada.
- **Vão livre de porta (`leaves = 0`)**: `void = true`; só verga/alizar/peitoril se existirem; **sem batente**.

### 3.3 Janelas

- Perímetro do caixilho: duas ombreiras `J`, `head` (z ∈ [H−J, H]) e `sillFrame` (z ∈ [0, J]), profundidade `D` em torno de `C`.
- **Fixa** (`plan 'fixed'`): vidro `glass` em `s ∈ C ± G/2`, `t ∈ [−hw+J, hw−J]`, `z ∈ [J, H−J]`; divisões `grid.cols × grid.rows` com `muntin` de largura `0,025` e espessura `D·0,6` (ou menos que o batente).
- **Maxim-ar** (`plan 'casement'`, família `window_casement`): a folha é uma **moldura de folha** (4 `leaf` de largura `lw = max(0,025, J·0,6)`) com `glass` dentro, inserida no caixilho com `gap`; eixo `rotate axis 't'` no topo da folha, em `(s = C, z = H − J)`, abre para `side`, `angle3d` padrão 30°. `LeafOpening.kind = 'top'`.
- **Basculante** (`plan 'tilt'`): igual, eixo embaixo (`z = J`), `kind = 'bottom'`. Sem tipo no catálogo padrão (0017 §11).
- **Correr** (`plan 'sliding'`, 2 ou 3 folhas): `n` folhas em pistas `s = C + (k − (n−1)/2)·pitch`, `pitch = max(L, 0,02) + 0,004`; cada folha com moldura `lw` + vidro; largura `(2·(hw−J) + (n−1)·0,05)/n`; folhas alternadas deslizam sobre a vizinha (`slide`, `travel` = largura − 0,05); trilhos no `head`/`sillFrame`.
- **Vão livre (`leaves = 0`)**: `void = true`; só soleira (`sillFrame` mais baixo), verga, contraverga.

### 3.4 Detalhes (todas as famílias)

- **`leafStyle`**: `flush` = só a folha; `panel` = 2 colunas × 2 linhas de `leafPanel` em relevo `0,006` nas duas faces; `glass` (porta) = folha vazada com estilos `0,10` laterais/topo, `0,22` embaixo e `glass` no vão; `louver` = aletas horizontais `leafPanel` (altura `0,035`, passo `0,055`); `grille` = barras verticais.
- **`handle`**: `lever` = roseta `0,05×0,012×0,05` mais haste `0,13×0,012×0,02`, a `z = 1,0`, a `0,06` do lado do trinco, nas duas faces; `knob` = caixa `0,05`; `pull` = barra `0,02×0,03×0,40` em `z = 1,0` na face do lado de `side`. Move junto com a folha (`leaf` index).
- **`grid`** (janela): montantes e travessas dividem o vidro em `cols × rows` painéis iguais.
- **`transom`**: travessa fixa `leaf`-material em `z ∈ [H − J − th − 0,04, H − J − th]`, vidro fixo acima; a altura da folha desce. **`sidelights`**: vidro fixo de largura `w` em cada lado marcado, com montante `0,04` entre ele e a folha; a largura da folha diminui.
- **Alizar `casing`**: 3 (porta) ou 4 (janela) caixas por face da parede, largura `width`, espessura `thickness`, encostadas nas faces (`s ∈ [thickness/2, thickness/2 + ct]` e o espelho). **Peitoril saliente `sillBoard`**: `t ∈ ±(hw + 0,03)`, `s ∈ ±(thickness/2 + projection)`, `z ∈ [−t, 0]`. **Verga `lintel`**: concreto, `t ∈ ±(hw + over)`, `z ∈ [H, H + height]`, `s` = núcleo; **contraverga `sillBeam`** idem abaixo de `z = 0`. **Soleira de porta `threshold`**: `z ∈ [0, 0,02]` só se o tipo pedir (campo futuro; hoje nenhuma).
- **Vão bruto**: `roughOversize` não muda as peças; só o furo (já existe no recorte da parede).

## 4 · Vistas

### 4.1 Planta (agente P)

Nível de detalhe efetivo: `type.detail2d` se ≠ `'scale'`; senão pela escala: baixo quando 1 px ≥ 0,012 m, médio quando ≥ 0,004 m, alto caso contrário (o agente acha onde a vista expõe a escala; `View` do plano). `'off'` não desenha o símbolo.

- **low**: só a folha fechada como linha no plano médio da folha (e, na janela, as três linhas); sem arco.
- **mid** (padrão simbólico): ombreiras e travessa como perfis **cortados** (polígonos com a espessura real, na cor/espessura de corte); folha **aberta** em `angle2d`, desenhada como retângulo com espessura `L` (não como uma linha), mais o **arco** do fecho até a abertura, raio = comprimento da folha, centrado na dobradiça. Janela: três linhas + montantes + ombreiras; correr com pistas e seta.
- **high** (e `planDisplay = 'projected'`): tudo do mid, mais a folha **fechada** como retângulo cortado no plano médio da folha, alizar, peitoril saliente (projeção abaixo, fina), verga acima do corte (tracejada), vidro duplo (duas linhas finas) e a profundidade do batente correta (rebaixo com batedor).
- Quem decide `cut`, `projection-above`, `projection-below` continua sendo `openingViewOps`; o desenho vem de `slicePartsAtZ(modelo, cutZ)` e das peças fora do corte.
- Arco: `swingStyle` (`'arc'` padrão, `'dash'`, `'line'`); `showSwing = false` oculta.
- `openingSymbolPaths` (geom) deixa de ser a fonte: a planta e o DXF passam a usar o novo desenho; a função antiga só permanece se ainda houver chamador (remover quando não houver).

### 4.2 Corte e elevação (agente S)

`projectParts` por vista. Ordem de pintura pela profundidade. Corte transversal pela espessura (`axis = 't'` projetado em s): peças cortadas com a hachura do material e os perfis corretos (verga e contraverga em concreto, batente com rebaixo, folha com espessura, vidro duplo, peitoril saliente, alizar). Elevação: batente, folha(s) com `leafStyle`, vidro com divisões, maçaneta, bandeiras, alizar, peitoril. **V de abertura** por `openingLinePaths` com a convenção da seção 1; **nada** em folha fixa, bandeira ou vidro fixo. Correr: seta de deslocamento; pivotante: eixo; maxim-ar/basculante: V horizontal.

### 4.3 3D (agente T)

`openingPieces` vira um adaptador fino: `OpeningPart` → `OpeningPiece` (caixa centrada + dobradiça). Toda peça do modelo gera malha; o estado aberto usa `partTransformed` com `type.angle3d`. Cada campo do tipo que muda o modelo tem de mudar a malha (teste de assinatura de malha por campo). **A parede é um sólido único com o furo** (nada de caixas emendadas): o recorte já usa o vão bruto; garantir que o vão no 3D e na planta coincidam. Vidro com material translúcido e sem arestas internas duplicadas.

### 4.4 Prévia do diálogo (agente M)

A prévia **não desenha nada próprio**: planta = o desenho da §4.1 num recorte de parede; elevação/corte = §4.2; 3D = cena Three mínima (`apps/web`, uma `WebGLRenderer` compartilhada) montando as mesmas peças do §4.3, com a parede como um **único** sólido (Shape com furo, `ExtrudeGeometry`), em linhas e sombreado. Sem biblioteca nova.

## 5 · Regras gerais para todo agente

1. **Escopo**: só os arquivos da sua lista. Mudança fora dela = pare e explique no relatório.
2. **Código em português** nos comentários e mensagens, no estilo do vizinho (densidade de comentário, nomes, idioma). Arquivos usam CRLF no Windows: não reformate arquivos inteiros.
3. **Testes primeiro**: escreva os testes da sua entrega (vitest, `*.test.ts` ao lado do código) antes ou junto. Cada critério de aceitação do seu prompt vira ao menos um teste que **falha sem a sua mudança**.
4. **Verificação obrigatória antes de encerrar**: `npx vitest run <seus arquivos de teste> <testes dos módulos que você tocou>` e `npx tsc -p tsconfig.json --noEmit` e `node scripts/check-boundaries.mjs`. Tudo verde, ou o relatório diz exatamente o que falha.
5. **Não** altere `packages/model/src/types.ts` nem `openingModelTypes.ts` (do dono); se faltar campo, pare e peça no relatório.
6. **Nada de `git push`, `git reset --hard`, `git checkout` de arquivos alheios, `npm install`, nem apagar testes existentes**. Teste existente que contradiz a spec: atualize e **liste** no relatório com o motivo.
7. Commits pequenos na sua branch (`git add` só dos seus arquivos; mensagem `feat(esquadrias): ...`). Ao terminar, escreva `RELATORIO.md` na raiz da worktree: o que foi feito, arquivos, testes, pendências, decisões tomadas, qualquer divergência da spec.
8. Sem dependência nova. `packages/geom`, `model` e `engine` não importam `three`, `react` nem DOM.

## 3.5 · Famílias novas (agentes F1 portas, F2 janelas)

Famílias registradas em `OPENING_FAMILIES` (`packages/model/src/opening.ts`): `door_dblact` (`plan 'dblact'`, folhas 1 ou 2), `door_pocket` (`'pocket'`, 1), `door_bifold` (`'bifold'`, 2 ou 4), `door_accordion` (`'accordion'`, 1), `door_garage` (`'garage'`, 1), `window_hinged` (`'hinged'`, 1 ou 2), `window_hung` (`'hung'`, 2), `window_pivot` (`'pivotwin'`, 1), `window_louver` (`'louver'`, 1). `window_casement` continua sendo a **maxim-ar**. Tipos novos em `PartMotion`: `fold` (cadeia de painéis; o cálculo `foldPoint` em `openingModel.ts` já existe e está correto: não o altere) e, em `LeafOpening`, `both`, `slideAxis` e o `kind 'louver'`. Mesmas medidas-base da §3 (`J, D, L, G, ov, gap`, núcleo `C`).

- **Vai-e-vem** (`dblact`): batente `simple` (sem batedor); folha(s) centrada(s) em `C`, espessura `L`; dobradiça em `±(hw − J)` (uma folha: lado `h`; duas: uma em cada ombreira, largura `(hw − J) − 0,002` cada); `rotate axis 'z'`; `LeafOpening.both = true`, `side` = lado principal (`flipFacing`). Planta: arcos dos DOIS lados (o lado principal contínuo, o outro tracejado) e a folha aberta em `±angle2d`.
- **Embutir** (`pocket`): batente `simple` só com `head` e a ombreira do lado da abertura da folha; folha `L` em `C`; `slide` em `t` (`dt = ±1` para o lado `h`, `travel = largura da folha`); peça `pocket` tracejada (caixa `t` de `±hw` até `±(hw + largura da folha)`, `s` núcleo menos 0,02 de cada lado, `z` da folha) para a cavidade; `LeafOpening.kind 'slide'`. Planta: folha + cavidade tracejada + seta.
- **Dobrável** (`bifold`): 2 painéis (uma cadeia ancorada na ombreira de `h`) ou 4 (duas cadeias de 2, uma em cada ombreira, que se fecham no centro); largura do painel `2·lh / folhas`; `motion fold` com `index` 0, 1, (0, 1 da outra cadeia); trilho `track` no `head`. `LeafOpening.kind 'fold'`. Ângulo padrão 3D 70°, planta 55°.
- **Sanfonada** (`accordion`): 9 painéis estreitos (`2·lh / 9`), cadeia única ancorada em `h`, `motion fold`; sem maçaneta. Ângulo 3D padrão 75°.
- **Seccionada** (`garage`): painéis `leaf` horizontais (5 faixas iguais de altura `H/5`, com `leafPanel` de relevo), batente `simple`, trilhos `track` dashed nas laterais indo ao fundo; `slide` com `slideAxis 'z'`, `dz = 1`, `travel = H`; `LeafOpening.kind 'overhead'`. Planta: retângulo tracejado do painel recolhido projetado para o lado de abertura (comprimento `min(H, 2,5)`), linha da folha fechada.
- **Janela de abrir** (`hinged`): folhas com moldura de folha (`lw`) + vidro, dobradiça vertical (`rotate axis 'z'` na ombreira de `h`; com 2 folhas, uma em cada ombreira, largura `inner/2 − 0,002`), `angle3d` padrão 90° (limite 120). `LeafOpening.kind 'side'`. Planta: folha com espessura em `angle2d` + arco tracejado.
- **Guilhotina** (`hung`): 2 folhas em pistas `s = C ± (pitch/2)`, a de baixo sobe (`slide`, `slideAxis 'z'`, `dz = +1`, `travel = (H − 2J)/2 − 0,02`); a de cima fixa; a de baixo cobre `z ∈ [J, mid + 0,02]`, a de cima `[mid − 0,02, H − J]`. `LeafOpening.kind 'slide'`, `slideAxis 'z'`. Planta: duas linhas defasadas.
- **Pivotante** (`pivotwin`): uma folha com moldura e vidro, `rotate axis 'z'` em `t = 0`, `s = C`; `angle3d` padrão 90°; `LeafOpening.kind 'pivot'`, `radius = hw − J`. Planta: folha girada em `angle2d` mais arcos curtos tracejados nas duas pontas.
- **Veneziana** (`louver`): batente + aletas `leafPanel` horizontais (altura 0,04, passo 0,055, espessura 0,008) em toda a altura interna; cada aleta com `rotate axis 't'` em torno do próprio eixo central (`s = C`, `z` = centro da aleta), `sign` +1; `angle3d` padrão 45° (limite 70°); `LeafOpening.kind 'louver'`. Elevação: aletas inclinadas; planta: três linhas e traços diagonais curtos.
- **Convenção da linha de abertura** (V): vai-e-vem = V contínuo e V tracejado superpostos; dobrável/sanfonada = linhas dos painéis dobrados (zigue-zague) e sem V; seccionada = linhas horizontais das juntas e seta para cima; embutir = seta horizontal para a cavidade; guilhotina = seta vertical; pivotante = eixo e V sobre o eixo; veneziana = nada (as aletas já mostram); janela de abrir = V como giro lateral.
- Para cada família: modelo (`openingModel.ts`, num arquivo novo `packages/engine/src/openingModel<Doors|Windows>New.ts` chamado por uma linha de despacho), planta (`openingPlan.ts`), linhas (`openingLines.ts`), corte/elevação (`render/section`), 3D (`openingParts.ts`), IFC (`packages/io/src/ifc/ifcExport.ts`: `Operation` por família), quadro, tipos pré-cadastrados em `DEFAULT_OPENING_TYPES` (`packages/model/src/defaults.ts`, com `code`), `TypePreview`, e testes de invariantes (nada fora do vão, folha sem interseção com batente, movimentos coerentes, ids estáveis).
