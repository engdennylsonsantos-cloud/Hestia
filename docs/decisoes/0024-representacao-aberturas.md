# 0024 · Representação técnica de aberturas (planta, corte, elevação e o X)

Data: 2026-10-22. Complementa a [0017](0017-portas-e-janelas.md) (§6 corte e elevação, §8 planta) e a [0015](0015-graficos-de-vista.md)
(níveis de detalhe e categorias). Pesquisa completa, com URLs e marcações: [docs/aberturas/C-representacao-tecnica.md](../aberturas/C-representacao-tecnica.md).

## 1. Contexto

O dono pediu que as aberturas saiam tecnicamente corretas em planta, corte e elevação, e lembrou que o Revit "cria um X
unindo vértices". A pesquisa confirmou o X, mas com uma correção: no Revit é uma **linha simbólica opcional**, desenhada
pelo usuário (Autodesk, *Cut a Shaft Opening*: "If desired, add symbolic lines to the opening"), e não aparece sozinha.
A regra de sentido de abertura (tracejado × contínuo) **não foi encontrada** em fonte oficial: o texto da ABNT NBR 6492 é pago
e as fontes que consegui ler são de concurso e de tutorial.

## 2. Giro na elevação e no corte

- **Símbolo em V** (decisão do dono, 2026-10-22: "troque sim"). Substitui a diagonal única do topo da dobradiça à base do
  trinco, que a versão anterior desta decisão adotava. O V é a forma convencional do símbolo de giro em projeto brasileiro
  (prática corrente, não confirmada na NBR 6492): duas linhas partindo de um **vértice no lado da dobradiça**, no meio da
  altura, até as **duas pontas do lado do trinco** (topo e base). Desenhado num traço só de três pontos.
- **Convenção própria** (marcada como tal na pesquisa): sai **tracejado quando a folha abre para o observador** da elevação
  e **contínuo quando abre para o lado oposto**. A regra não mudou; só o desenho.
- O sentido vem de `swingTowardViewer` (engine, `section.ts`): o produto interno entre a normal da parede no sentido de giro
  (`flipFacing`) e a normal da linha de vista. Sem lado resolvível, sai tracejado.
- **Porta de giro** (1 folha): V com o vértice no meio da altura da dobradiça (`flipHand`).
- **Porta dupla**: um V por folha. Cada vértice fica na sua ombreira; as pontas, no centro, no topo e na base.
- **Porta pivotante**: o eixo vertical a W/4 da ombreira da dobradiça (mesma convenção da planta, decisão 0017 §8, ainda
  provisória) fica como traço; o vértice do V fica sobre ele, na altura média, e as pontas vão ao lado oposto.
- **Janelas de abrir** (E1): o maxim-ar tem o vértice no meio da aresta **superior** do caixilho (dobradiça no topo) e as
  pontas nos dois cantos inferiores; o basculante, o vértice na aresta **inferior** e as pontas nos cantos superiores. O
  arco tracejado de antes saiu. Na janela, o tracejado segue a mesma regra de `swingTowardViewer` (antes, sempre tracejado).
- **Janela de correr e fixa**: sem V (seta de correr e nada, como antes).
- Fato de apoio [DOC]: no Revit, o giro de porta em elevação é uma linha simbólica da família, visível só na vista em que
  foi desenhada (Autodesk, *About Creating 2D Geometry*, 2016).

## 3. X só em furo de piso, laje e telhado; vão livre de parede sem X

**Revisão de 2026-10-24.** A versão original desta seção pôs o X também no vão livre de parede, por uma lembrança do dono
de que "o Revit cria um X unindo vértices". A própria pesquisa (C §3) já mostrava que o X do Revit é linha simbólica
**opcional** do Shaft Opening (furo em piso ou laje) e que não havia fonte para Wall Opening. Nenhum dos dois programas
desenha X em vão de parede: o Revit interrompe a parede e mostra o contorno do vão em corte e elevação; o ArchiCAD, com
o vão vazio ("Empty Opening", tipo de porta ou janela como o nosso), interrompe a parede e só tem linhas opcionais de
contorno e de borda superior tracejada (fórum Graphisoft; as páginas oficiais de Wall Opening e Empty Opening não foram
lidas). Na planta o X ainda virava uma ampulheta ilegível nos 14 cm da parede, e na elevação concorria com o V de giro.

- **Vão livre de parede (0 folhas), planta**: segue o vão vazio do ArchiCAD. A parede é interrompida nos batentes (como já
  era) e o vão leva **duas linhas tracejadas, uma em cada face da parede**, de −W/2 a +W/2: as bordas superiores do vão
  (a verga, acima do plano de corte), com o tracejado que a decisão 0013 já usa para "acima do corte". Sem X e sem linha
  central. A primeira versão desta revisão pôs uma soleira contínua no meio; foi trocada por estas linhas. Evidência: só
  trechos de fórum da Graphisoft (as "overhead lines" do vão vazio são as bordas superiores; a opção de ligá-las é do próprio
  objeto); as páginas oficiais de Empty Opening não foram lidas. O Revit, por padrão, só interrompe a parede: o tracejado
  de borda no Wall Opening exige Linework ou overhead manual, e só janela, mobiliário e genérico aparecem acima do corte.
- **Vão livre, corte e elevação**: só o contorno do vão; a janela sem folha mantém a soleira (como no 3D). Sem diagonais.
- **Furo quadrangular de piso e laje, planta**: mantém o X, contorno mais **duas diagonais ligando os vértices opostos**
  (`voidCrossPaths`, em `packages/geom`; só `plan/holeMarks.ts` o usa, chamado por `plan/floors.ts` e `plan/slabs.ts`).
  Furo com mais de quatro vértices não leva X, porque a diagonal entre opostos só é definida em quadrilátero. **Telhado e
  forro não têm X hoje** (o texto anterior dizia "telhado"; ver §7).
- **Nível de detalhe do X de furo**: não sai no grosseiro (decisão 0015); sai no médio e no fino.
- **Peso e visibilidade do X de furo**: seguem o traço de projeção do piso ou da laje (categoria do elemento).
  **Não criei categoria gráfica nova**: o X de furo segue a categoria existente do elemento, como a decisão 0015 permite.
- **Traço do X de furo**: sem fonte oficial de peso nem de tracejado ([NÃO ENCONTRADO]). Convenção própria: contínuo e fino.
- **Revit, Wall Opening**: sem X, confirmado pela ausência de fonte em C §3 e pelo comportamento conhecido do programa.

## 4. DXF

- O símbolo do vão de corte (folha, arco, soleira do vão livre) vai à camada **`ABERTURA_SIMBOLO`**, com o peso de corte da categoria `window`
  (porta e janela juntas, como em `ABERTURAS`). O retângulo do vão sem símbolo continua em `ABERTURAS`.
- As camadas de projeção (`ABERTURA_ACIMA`, `_ABAIXO`, `_ALEM`) não mudam.
- **Não feito**: símbolo de giro no DXF de corte (`dxfSection.ts` recebe só polígonos do vão) e X dos furos no DXF de planta.

## 5. O que não mudou

- Níveis de detalhe (decisão 0015): no grosseiro, sem símbolo de vão e sem X de furo, na planta e também na elevação
  (V e seta de correr; antes o corte e a elevação desenhavam esses traços no grosso). Médio e fino têm o mesmo
  símbolo de vão: nenhuma diferença foi implementada entre os dois. Fonte: Graphisoft AC26, *Door/Window Settings and Opening*, 2D
  Detail Level (`By MVO`, `Scale Sensitive`, escala fixa, `Off`).
- Projeção acima do corte: tracejada, como já era (decisão 0013).
- `SCHEMA_VERSION` não foi incrementado; não há campo novo no modelo.

## 6. Verificação

- Testes: geometria do X e do giro (`openingSymbol.test.ts`, `build.test.ts`: V por família, `hand`/`flipFacing`, grosso e linhas finas), X de furo (`holeMarks.test.ts`, `floors.test.ts`,
  `slabs.test.ts`), DXF (`dxf.test.ts`, `dxfExport.test.ts`).
- Regressão visual: os casos `piso-com-furo` e `laje-com-furo` mudaram 0,136 % cada, só pelo X do furo; as imagens foram lidas
  e as duas baselines regravadas. Na troca do giro para o V, só `elevacao-porta-janela` mudou (ver a revisão SV1 em §6). Três casos novos, com baseline criada e conferida:
  `planta-porta-janela`, `laje-abertura-x` e `elevacao-porta-janela`.

- Revisão SV1 (giro em V): só `elevacao-porta-janela` mudou, 0,090 % antes da regravação. A imagem nova mostra a porta de
  giro com o V (vértice na dobradiça a meia altura, pontas no trinco, contínuo porque a folha abre para longe), e o diff fica
  só dentro da folha. Os outros 29 casos seguem em 0,000 %. Baseline regravada sem `--update` geral.

- Revisão do X (2026-10-24, vão livre sem X): testes ajustados em `openingSymbol.test.ts` (duas linhas tracejadas nas faces,
  também com a rotação do vão), `symbols.test.ts`, `build.test.ts` (sem diagonais no corte, na elevação e no grosso) e
  `dxf.test.ts` (traço reto contínuo em `ABERTURA_SIMBOLO`). `holeMarks`, `floors` e `slabs` não mudaram: o X de furo segue como estava.
  Baselines visuais: `planta-porta-janela` e `elevacao-porta-janela` mudaram só no vão livre, e as imagens foram lidas.
  Como a máquina desta revisão (Windows) não reproduz as baselines de Linux (o canvas sai 4 px mais baixo e a interface da
  branch `feat/revit-ui-theme` tem a barra de escala; os 36 casos divergem por isso, 100 % ou cerca de 2 %, com ou sem a
  mudança), as duas baselines foram **remendadas**: a imagem antiga ficou intacta e só o retângulo do vão foi trocado pelo
  da renderização nova. **Pendente em Linux**: rodar `node tests/e2e/visual-regression.mjs` (CPU) e regravar, se preciso,
  e regravar `baseline-gpu/planta-porta-janela.png` (`visual-regression-gpu.mjs --update`, que exige o Chromium de
  `/opt/pw-browsers`), que ainda mostra o X.

## 7. Fora desta entrega

- DXF de corte com giro e X (ver §4).
- Verga e peitoril na planta quando o corte passa por eles.
- Janela de giro (side-hung) como família: o giro fica no maxim-ar e no basculante, como antes.
- X de telhado (claraboia) e de forro: não ligados; só piso e laje o desenham. O Revit trata Vertical Opening e Shaft como
  corte em piso, telhado e forro, então é a próxima lacuna.
- Porta pivotante: a posição do eixo segue provisória (W/4), sem fonte oficial.
- Chave por categoria para ligar e desligar só o X: exigiria categoria nova no modelo.

## 8. Fontes

- [DOC] Autodesk, *Cut a Shaft Opening* (RevitLT 2024): https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-ArchDes/files/GUID-FA0CF7B6-D3E1-4F58-AE02-A19457BBCD02.htm (lida em 2026-10-22).
- [DOC] Autodesk, *About Creating 2D Geometry* (Revit 2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-4949A893-E556-4426-AE1D-0BC3C90BF672.htm (lida em 2026-10-22).
- [DOC] Graphisoft AC26, *Symbolic vs. Projected* e *Door/Window Settings and Opening* (URLs em `docs/aberturas/C-representacao-tecnica.md` §6).
- [SEC] Fóruns AUGI, Autodesk e Graphisoft e tutorial de família (somente trechos de busca; ver C §0).
- [NÃO ENCONTRADO] ABNT NBR 6492:2021 (texto pago, não acessado) e regra de sentido de abertura.
