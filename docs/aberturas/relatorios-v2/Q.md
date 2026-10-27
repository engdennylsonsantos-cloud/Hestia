# RELATÓRIO · Tarefa Q — catálogo completo de esquadrias

## O que foi feito

1. **Padrões por família em `openingStyle.ts`**
   - `openingAngle2d`: 55° no dobrável (`bifold`), 60° na janela de abrir (`hinged`) e 90° nas demais.
   - `openingAngle3d`: 30° na maxim-ar/basculante, 45° na veneziana (teto de 70°), 70° no dobrável, 75° na sanfonada e 90° nas demais (embutir, seccionada, guilhotina e correr devolvem 90 sem efeito).
2. **Ventilação útil em `openingChecks.ts`**: janela de abrir 100%, guilhotina 50%, pivotante 90% e veneziana 70%; portas continuam sem ventilação útil.
3. **Projeto-mostruário `esquadrias`** (`templateEsquadrias.ts`, registrado em `templates.ts`):
   - um nível (o `lv_1` é removido no build);
   - duas paredes de 40 m: portas em `y = 0` (parte de baixo da planta) e janelas na paralela em `y = 8`;
   - os 23 tipos do catálogo, na ordem de `DEFAULT_OPENING_TYPES`, com 1,5 m entre vizinhos e 1,5 m na ponta esquerda;
   - metade variada: `flipHand` nos índices ímpares e `flipFacing` no 3º e 4º de cada grupo de quatro (as quatro combinações aparecem).
4. **Suíte de invariantes do catálogo** (23 tipos × 4 combinações × estados fechado/aberto) provando modelo, planta, elevação, corte transversal, 3D, IFC e quadro.

## Defeitos encontrados e correções

| # | Tipo / vista | Causa | Correção |
|---|---|---|---|
| 1 | Modelo 3D: `openingAngle3d` das famílias novas | O fallback antigo só olhava `kind` e `casement/tilt`, então veneziana, dobrável e sanfonada caíam em 90° e a veneziana não tinha teto de 70°. | Tabela de padrões por símbolo de planta; teto de 70° na veneziana. Teste em `openingStyle.test.ts`. |
| 2 | Planta: `openingAngle2d` | O fallback fixo em 90° ignorava os padrões da spec para dobrável (55°) e janela de abrir (60°). | `angle2dPadrao(plan)` com 55/60/90. Teste em `openingStyle.test.ts`. |
| 3 | Verificações do tipo: ventilação | As quatro famílias novas de janela caíam no `default: 0` de `ventilationFactor`. | Frações 1 / 0,5 / 0,9 / 0,7. Teste em `openingChecks.test.ts`. |
| 4 | Catálogo / conferência visual | Não existia projeto com todos os tipos. | Template `esquadrias` e teste em `templateEsquadrias.test.ts`. |

**Nenhum outro defeito de modelo, planta, corte/elevação, 3D, IFC ou quadro foi revelado** pela suíte nova: todas as invariantes passaram no código existente depois dos itens acima. Os erros iniciais da própria suíte eram hipóteses de teste (portão seccionado e embutir saem do vão por projeto; vão livre não tem linhas de caixilho), não defeitos do produto; os testes foram ajustados e o motivo está registrado no próprio teste.

## Arquivos tocados

- `packages/model/src/openingStyle.ts` (+ `.test.ts`)
- `packages/engine/src/openingChecks.ts` (+ `.test.ts`)
- `packages/model/src/templates.ts`
- `packages/model/src/templateEsquadrias.ts` (novo) (+ `.test.ts` novo)
- `packages/engine/src/openingCatalogo.test.ts` (novo)
- `packages/render/src/openingCatalogoVistas.test.ts` (novo)
- `packages/io/src/ifc/ifcExport.test.ts`

Nenhum arquivo fora da lista permitida foi alterado. `packages/model/src/types.ts` e `openingModelTypes.ts` não foram tocados.

**Testes existentes**: nenhum precisou ser alterado por contradizer a spec; os arquivos `openingStyle.test.ts` e `openingChecks.test.ts` só ganharam casos novos. Não havia teste contando `TEMPLATES`; o novo `templateEsquadrias.test.ts` passa a conferir o registro e a lista de modelos iniciais.

## Testes

Novos/atualizados, todos verdes:

- `packages/model/src/openingStyle.test.ts` — padrões 2D/3D por família e teto da veneziana.
- `packages/engine/src/openingChecks.test.ts` — ventilação das famílias novas e portas sem ventilação.
- `packages/model/src/templateEsquadrias.test.ts` — registro, um nível, duas paredes de 40 m, 23 tipos, folgas de 1,5 m e as quatro combinações de flips.
- `packages/engine/src/openingCatalogo.test.ts` — família de cada `id`, `openingTypeIssue`, caixas/ids/determinismo, folha × batente, isometria do movimento, lado do giro, deslizamentos/dobra/cavidade, planta low/mid/high, arcos de giro/dupla/vai-e-vem/pivotante, linhas de face das janelas, quadro.
- `packages/render/src/openingCatalogoVistas.test.ts` — elevação das duas paredes, corte transversal por vão, V/tracejado e ausência de linha em fixa/veneziana, `openingSymbol`, `openingPieces`, `montarAbertura` e `caixasDaAbertura` (centros equivalentes), limites do vão, recolhimento do portão e cavidade da embutir.
- `packages/io/src/ifc/ifcExport.test.ts` — mostruário sem exceção, referências íntegras, 12 portas + 11 janelas, uma `Operation` por porta, um `IFCWINDOWPANELPROPERTIES` por janela e nenhum `NOTDEFINED`.

Comandos rodados no fim:

- `npx vitest run packages/engine packages/model packages/render packages/io --exclude "**/property.test.ts" --exclude "**/perf.test.ts"` → **271 arquivos, 3373 testes verdes**.
- `npx tsc -p tsconfig.json --noEmit` → limpo.
- `node scripts/check-boundaries.mjs` → `fronteiras ok`.

## Divergências / pendências honestas

- **Portão seccionado aberto**: por spec E §3.5, as faixas sobem `travel = H` e ficam acima do vão. O invariante de 3D “dentro do vão” é verificado com essa exceção explícita; fechado, tudo fica no vão.
- **Porta de embutir aberta**: a folha entra na cavidade (`pocket`), fora da largura nominal do vão. O teste confere que ela fica contida na caixa da cavidade, como manda a spec.
- **Porta pivotante e janela pivotante**: o centro da folha vai para o lado oposto ao `side` (banda curta vai para `side`, a longa para o oposto, E §3.2/§3.5). Por isso o teste “folha no lado `side`” vale para `kind: 'side'`; as pivotantes são conferidas pelo eixo e pelo raio.
- **Linhas de abertura no corte transversal**: `buildSectionDrawList` só emite V/setas na vista de face (`faceOn`); o corte transversal mostra os perfis. A convenção do V é provada em `openingLinePaths` (todos os 23 tipos) e nos testes existentes de elevação. Se o dono quiser V também no corte por espessura, é uma decisão nova.
- **Vão livre de janela**: a planta desenha as duas linhas tracejadas das faces (papel `mark`), não as três linhas de caixilho — não há caixilho.
- **Dimensão do mostruário**: as paredes têm os 40 m pedidos, mas os vãos terminam em ~32,1 m (portas) e ~29,7 m (janelas), deixando o restante da parede livre; a folga de 1,5 m é garantida entre vãos e na ponta esquerda.
- **Bandeiras superiores**: o catálogo padrão não tem tipo com `transom`; a regra “bandeira fixa sem linha” continua coberta pelo teste existente `openingLines.test.ts` (fixa com bandeira) e pelo teste novo de família fixa.
- O `RELATORIO.md` é o único arquivo não commitado, na raiz, como pede o COMMON.
