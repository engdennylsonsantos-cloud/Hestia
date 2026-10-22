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

- **Convenção própria** (marcada como tal na pesquisa): o símbolo de giro é a diagonal do topo da dobradiça à base do trinco.
  Sai **tracejado quando a folha abre para o observador** da elevação e **contínuo quando abre para o lado oposto**.
- O sentido vem de `swingTowardViewer` (engine, `section.ts`): o produto interno entre a normal da parede no sentido de giro
  (`flipFacing`) e a normal da linha de vista. Sem lado resolvível, sai tracejado.
- Porta dupla: duas diagonais, uma de cada ombreira ao centro da base. Porta pivotante: eixo vertical a W/4 da ombreira da
  dobradiça, mais a diagonal da folha (mesma convenção de eixo da planta, decisão 0017 §8, ainda provisória).
- Fato de apoio [DOC]: no Revit, o giro de porta em elevação é uma linha simbólica da família, visível só na vista em que
  foi desenhada (Autodesk, *About Creating 2D Geometry*, 2016).

## 3. X de vão sem esquadria

- **Onde**: (a) vão livre de parede (0 folhas), na planta e no corte/elevação; (b) furo quadrangular de piso e laje, na planta.
- **Como**: contorno mais **duas diagonais ligando os vértices opostos** (`voidCrossPaths`, em `packages/geom`). Furo com mais
  de quatro vértices não leva X, porque a diagonal entre opostos só é definida em quadrilátero.
- **Nível de detalhe**: não sai no grosseiro (decisão 0015); sai no médio e no fino.
- **Peso e visibilidade**: seguem a categoria da abertura na vista de corte (porta ou janela; categoria oculta, sem X).
  Na planta, o X sai com o traço leve da própria abertura; nos furos, com o traço de projeção do piso ou da laje.
  **Não criei categoria gráfica nova**: o pacote `model` não está na área de edição desta entrega, e o X é ligado pela
  categoria existente da abertura, como a decisão 0015 permite.
- **Traço do X**: sem fonte oficial de peso nem de tracejado ([NÃO ENCONTRADO]). Convenção própria: contínuo e fino.
- **Revit, Wall Opening**: não achei página que diga que ele desenha X ([NÃO ENCONTRADO]). O X de parede do Hestia é
  convenção própria para o vão livre, não cópia do Revit.

## 4. DXF

- O símbolo do vão de corte (folha, arco, X) vai à camada **`ABERTURA_SIMBOLO`**, com o peso de corte da categoria `window`
  (porta e janela juntas, como em `ABERTURAS`). O retângulo do vão sem símbolo continua em `ABERTURAS`.
- As camadas de projeção (`ABERTURA_ACIMA`, `_ABAIXO`, `_ALEM`) não mudam.
- **Não feito**: símbolo de giro e X no DXF de corte (`dxfSection.ts` recebe só polígonos do vão) e X dos furos no DXF de planta.

## 5. O que não mudou

- Níveis de detalhe (decisão 0015): no grosseiro, sem símbolo de vão e sem X de furo. Médio e fino têm o mesmo símbolo de
  vão: nenhuma diferença foi implementada entre os dois. Fonte: Graphisoft AC26, *Door/Window Settings and Opening*, 2D
  Detail Level (`By MVO`, `Scale Sensitive`, escala fixa, `Off`).
- Projeção acima do corte: tracejada, como já era (decisão 0013).
- `SCHEMA_VERSION` não foi incrementado; não há campo novo no modelo.

## 6. Verificação

- Testes: geometria do X e do giro (`openingSymbol.test.ts`, `build.test.ts`), X de furo (`holeMarks.test.ts`, `floors.test.ts`,
  `slabs.test.ts`), DXF (`dxf.test.ts`, `dxfExport.test.ts`).
- Regressão visual: os casos `piso-com-furo` e `laje-com-furo` mudaram 0,136 % cada, só pelo X do furo; as imagens foram lidas
  e as duas baselines regravadas. Os demais 25 casos seguem em 0,000 %. Três casos novos, com baseline criada e conferida:
  `planta-porta-janela`, `laje-abertura-x` e `elevacao-porta-janela`.

## 7. Fora desta entrega

- DXF de corte com giro e X (ver §4).
- Verga e peitoril na planta quando o corte passa por eles.
- Janela de giro (side-hung) como família: o giro fica no maxim-ar e no basculante, como antes.
- X de telhado (claraboia): o telhado não foi testado com furo quadrangular.
- Porta pivotante: a posição do eixo segue provisória (W/4), sem fonte oficial.
- Chave por categoria para ligar e desligar só o X: exigiria categoria nova no modelo.

## 8. Fontes

- [DOC] Autodesk, *Cut a Shaft Opening* (RevitLT 2024): https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-ArchDes/files/GUID-FA0CF7B6-D3E1-4F58-AE02-A19457BBCD02.htm (lida em 2026-10-22).
- [DOC] Autodesk, *About Creating 2D Geometry* (Revit 2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-4949A893-E556-4426-AE1D-0BC3C90BF672.htm (lida em 2026-10-22).
- [DOC] Graphisoft AC26, *Symbolic vs. Projected* e *Door/Window Settings and Opening* (URLs em `docs/aberturas/C-representacao-tecnica.md` §6).
- [SEC] Fóruns AUGI, Autodesk e Graphisoft e tutorial de família (somente trechos de busca; ver C §0).
- [NÃO ENCONTRADO] ABNT NBR 6492:2021 (texto pago, não acessado) e regra de sentido de abertura.
