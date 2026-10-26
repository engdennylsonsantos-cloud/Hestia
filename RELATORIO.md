# Relatório F2 · Janelas novas (abrir, guilhotina, pivotante, veneziana)

## O que foi feito

- Modelo único das quatro famílias novas de janela em `packages/engine/src/openingModelWindowsNew.ts`, chamado por uma linha de despacho no `default` de `buildWindow` (`openingModel.ts`):
  - **janela de abrir** (`window_hinged`): 1 folha na ombreira de `flipHand` ou 2 folhas (uma em cada ombreira), moldura + vidro, giro vertical (`rotate axis 'z'`), `LeafOpening.kind 'side'`.
  - **guilhotina** (`window_hung`): duas folhas em pistas `s = C ± pitch/2`; a de baixo sobe com `slide` em `z` (`travel = (H − 2J)/2 − 0,02`) e a de cima fica fixa; `kind 'slide'` com `slideAxis 'z'` na móvel.
  - **pivotante** (`window_pivot`): uma folha com moldura e vidro girando em torno do eixo vertical central (`t = 0`, `s = C`), `kind 'pivot'`, `radius = hw − J`.
  - **veneziana** (`window_louver`): aletas horizontais `leafPanel` (altura 0,04, passo 0,055, espessura 0,008) cobrindo a altura interna; cada aleta gira em torno do próprio eixo (`rotate axis 't'`, `s = C`, `z` do centro), `kind 'louver'`.
- Planta (`openingPlan.ts`): folha de abrir aberta com espessura + arco tracejado; guilhotina com duas linhas defasadas; pivotante com folha girada + dois arcos curtos tracejados; veneziana com as três linhas do caixilho e traços diagonais tracejados das aletas.
- Linhas de abertura (`openingLines.ts`): guilhotina ganhou seta vertical (haste + ponta); as demais já caíam nas regras existentes (V de giro lateral no `side`, eixo + V no `pivot`, nada no `louver`).
- 3D (`openingParts.ts`): o adaptador já aplicava `rotate`/`slide` genericamente; só foi acrescentado o limite de 70° da veneziana. As peças novas (aletas, duas folhas em pistas) chegam ao 3D sem adaptação adicional.
- Corte/elevação: o desenho genérico de `section/build.ts` já projeta todas as peças do modelo; nenhuma mudança foi necessária (testes cobrem aletas e duas folhas em pistas).
- IFC (`ifcExport.ts`): `windowOperation` mapeia as famílias para `IfcWindowPanelOperationEnum` e cada janela passa a sair com `IFCWINDOWPANELPROPERTIES` + `IFCRELDEFINESBYPROPERTIES`.
- Catálogo (`defaults.ts`): acrescentados ao fim das janelas
  - `ot_ja120` (J-07, abrir 2 folhas 120×120, peitoril 1,10)
  - `ot_jg90` (J-08, guilhotina 90×150, peitoril 0,90)
  - `ot_jp80` (J-09, pivotante 80×120, peitoril 1,00)
  - `ot_jv80` (J-10, veneziana 80×60, peitoril 1,50, `angle3d: 45`).

## Arquivos tocados

- `packages/engine/src/openingModelWindowsNew.ts` (novo)
- `packages/engine/src/openingModelWindowsNew.test.ts` (novo)
- `packages/engine/src/openingModel.ts` (import + uma linha de despacho)
- `packages/engine/src/openingPlan.ts`
- `packages/engine/src/openingPlanWindowsNew.test.ts` (novo)
- `packages/engine/src/openingLines.ts`
- `packages/engine/src/openingLinesWindowsNew.test.ts` (novo)
- `packages/render/src/model3d/openingParts.ts`
- `packages/render/src/model3d/openingPartsWindowsNew.test.ts` (novo)
- `packages/render/src/model3d/openingParts.test.ts` (contagem de catálogo e vidro da veneziana)
- `packages/render/src/section/buildWindowsNew.test.ts` (novo)
- `packages/io/src/ifc/ifcExport.ts`
- `packages/io/src/ifc/ifcWindowOperation.test.ts` (novo)
- `packages/model/src/defaults.ts`

## Testes

Comandos executados (Git Bash, na raiz):

- `npx vitest run packages/engine/src/openingModelWindowsNew.test.ts packages/engine/src/openingPlanWindowsNew.test.ts packages/engine/src/openingLinesWindowsNew.test.ts packages/render/src/model3d/openingPartsWindowsNew.test.ts packages/render/src/section/buildWindowsNew.test.ts packages/io/src/ifc/ifcWindowOperation.test.ts` — 38 testes verdes.
- `npx vitest run packages/render/src/model3d/openingParts.test.ts packages/render/src/model3d/scene3d.test.ts packages/engine/src/openingModel.test.ts packages/engine/src/openingPlan.test.ts packages/engine/src/openingLines.test.ts packages/engine/src/openingChecks.test.ts packages/engine/src/openingSchedule.test.ts packages/render/src/section/build.test.ts packages/io/src/ifc/ifcExport.test.ts packages/model/src/opening.test.ts packages/model/src/esquema.test.ts packages/model/src/openingStyle.test.ts` — 257 testes verdes.
- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `node scripts/check-boundaries.mjs` — `fronteiras ok`.

Cobertura dos critérios: ids estáveis e únicos, caixas válidas, tudo no vão (exceto acabamentos), folhas/aletas sem volume comum com o caixilho, `openings[]` por família, movimentos de `partTransformed` (giro lateral, subida da guilhotina, pivô em `t = 0`, aletas no próprio centro), planta das quatro famílias, linhas de abertura, 3D fechado/aberto sem vazar, elevação e corte transversal, operação IFC e catálogo passando por `openingTypeIssue`/gerando modelo.

## Testes existentes atualizados

- `packages/render/src/model3d/openingParts.test.ts`
  - contagem do catálogo de 14 → 18 (os quatro tipos novos);
  - no teste de vidro/moldura dentro do vão interno, a veneziana não tem vidro (as aletas substituem o pano, spec E §3.5), então a exigência de ao menos um vidro passou a valer só para as famílias com vidro.

## Divergências da spec / decisões

1. **Ângulo padrão da veneziana.** `packages/model/src/openingStyle.ts` não estava na lista de arquivos permitidos. Por isso o padrão de 45° foi gravado no tipo `ot_jv80` (`angle3d: 45`), e o limite de 70° é aplicado no adaptador 3D (`openingPieces`). Um tipo `louver` criado sem `angle3d` herda 90° do padrão genérico de janela, mas o 3D o limita a 70°.
2. **IFC.** O IFC4 não tem `Operation` no `IFCWINDOW`; o atributo vive no `IFCWINDOWPANELPROPERTIES`. O exportador passou a emitir um painel por janela com a operação e o vínculo `IFCRELDEFINESBYPROPERTIES`. A veneziana não tem valor no enum e usa `TILTANDTURNLEFTHAND`/`TILTANDTURNRIGHTHAND` (o mais próximo); a pivotante usa `PIVOTVERTICAL` (eixo vertical).
3. **Planta da veneziana.** A spec pede “três linhas e traços diagonais curtos”; o desenho adotado são traços diagonais tracejados distribuídos ao longo da largura, com papel `leafPanel`.

## Pendências honestas

- `openingChecks` continua tratando as famílias novas como ventilação 0 (mostra o aviso de “não conta como ventilação”) porque `packages/engine/src/openingChecks.ts` não estava na lista de arquivos permitidos.
- `TypePreview.tsx` não tem `switch` por símbolo; a prévia das famílias novas usa o desenho genérico de janela com uma folha por contagem (guilhotina aparece lado a lado em vez de empilhada e a veneziana sem as aletas). Nada foi alterado ali, conforme a condição do prompt.
- `section/build.ts` não precisou de mudança: o desenho a partir de `projectParts` já cobre as peças novas. Os testes novos provam aletas e pistas.
