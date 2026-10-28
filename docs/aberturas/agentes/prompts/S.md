# Tarefa S · Corte e elevação das esquadrias a partir do modelo único

Leia: spec E §1 e §4.2; `packages/engine/src/openingModel.ts` e teste (já existe; NÃO o altere, registre no RELATORIO.md o que faltar); `packages/engine/src/section.ts` (`SectionEsquadria`, onde monta por vão), `packages/render/src/section/build.ts` e `build.test.ts`, os outros arquivos de `packages/render/src/section/` que desenham, `packages/engine/src/resolve.ts` (`openingGeometry`), `packages/model/src/openingStyle.ts` (`openingLineConvention`, estilos).

## Arquivos permitidos
`packages/engine/src/section.ts` (+ testes dele), `packages/render/src/section/*` (+ testes), novo `packages/engine/src/openingLines.ts` + `openingLines.test.ts` (função pura `openingLinePaths`, exporte no `index.ts` do engine com uma linha). Nada de planta, 3D, ferramentas, diálogo.

## O que fazer
1. `openingLinePaths(model: OpeningModel, viewSide: 1 | -1, conv: OpeningLineConvention, view: 'elevation' | 'section'): Array<{ pts: Array<{ u: number; z: number }>; dashed: boolean }>` conforme spec §1 (convenção do V decidida pelo dono: **vértice no lado oposto ao da dobradiça**, `apex: 'latch'` padrão; tracejado quando abre PARA o observador, `dashed: 'toward'` padrão; os dois configuráveis). Coordenada horizontal da tela `x = −viewSide·t`. Por `LeafOpening`: giro lateral → V com vértice no lado do trinco a meia altura da folha e pontas nos dois cantos (superior e inferior) do lado da dobradiça; maxim-ar → vértice embaixo, pontas em cima no eixo; basculante o inverso; pivotante → vértice sobre o eixo; correr → seta horizontal; fixa/bandeira/vidro fixo → **nada**.
2. `engine/section.ts`: cada vão da lista carrega o `OpeningModel` (use `buildOpeningModel`) e a convenção do projeto, no lugar do `SectionEsquadria` antigo (pode manter o campo antigo como opcional se algo externo o lê; migre o que for do render).
3. `render/section/build.ts`: elevação e corte desenhados com `projectParts`/`slicePartsAtZ`: batente com rebaixo e batedor, folha(s) com `leafStyle` (almofadas, vidro, aletas, grelha), vidro com divisões (montantes), maçaneta, bandeira e bandeiras laterais, alizar, peitoril saliente, trilhos; no **corte transversal** (pela espessura): peças cortadas com a hachura do material (verga e contraverga em concreto, madeira/alumínio no batente e folha), vidro duplo, peitoril saliente projetado; ordem de pintura pela profundidade. Linhas de abertura com `openingLinePaths`.
4. Vão livre: só contorno (sem X), como hoje.

## Critérios de aceitação (testes)
- `openingLinePaths`: porta `ot_p90` (dobradiça em `t = −0,411`), `viewSide = +1`, convenção padrão: vértice no lado do trinco a meia altura da folha, pontas no lado da dobradiça nos cantos superior e inferior (use a fórmula da spec para a coordenada de tela); tracejado quando `opening.side === viewSide`, contínuo caso contrário; `apex: 'hinge'` e `dashed: 'away'` invertem exatamente; `flipHand` espelha; bandeira superior e vidro fixo → zero linhas; janela maxim-ar → vértice embaixo.
- Elevação da porta com `leafStyle 'panel'` contém as 4 almofadas; com `glass` o vidro; com `handle 'lever'` a maçaneta no lado do trinco a z ≈ 1,0.
- Corte transversal da janela com peitoril saliente e verga: peças de concreto com hachura de concreto, batente com a profundidade/posição do modelo (centrado no núcleo, não no eixo), vidro com a espessura do tipo.
- Os testes antigos de `build.test.ts` que descreviam o desenho antigo são atualizados e listados no RELATORIO.md.
