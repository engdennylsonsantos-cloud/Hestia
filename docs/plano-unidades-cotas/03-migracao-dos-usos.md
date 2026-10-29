# Fase C: migrar TODOS os usos soltos para o serviço de unidades

Pré-requisito: Fases A e B. Objetivo: nenhum texto de interface com número/unidade sai de `toFixed`, `replace('.', ',')`, `"m²"` literal, `unit="m"`, `scale={100}` etc. Tudo passa por `formatQuantity` / `NumField quantity` / `parseQuantityText`. Uma **trava automática** impede regressão.

**Donos:** UNID faz C0–C3, C5 e C7; ESQ faz C4 e C6 (depois que a UNID integrar C0 e a Fase A). **Arquivos reservados ao COTAS (não migre; ficam na linha de base até o COTAS removê-los na Fase E):** `packages/tools/src/openingPlacement.ts`, `openingDims.ts`, `openingTool.ts`, `apps/web/src/ui/OpeningTempDims.tsx`, `ViewportOverlays.tsx`, `PlacementProperties.tsx` (linha do select "Cotas"), `packages/engine/src/autoCotas.ts` (só a unificação de referências; a retirada de `unit`/`precision` fixos ao criar cotas é da UNID em C5 nos demais arquivos).

## C0: a trava (faça primeiro)
1. Crie `scripts/check-units.mjs` (Node, sem dependências, estilo de `scripts/check-boundaries.mjs` — leia-o antes). Varre `packages/*/src/**/*.{ts,tsx}` e `apps/web/src/**/*.{ts,tsx}`, **exceto** `*.test.*`, `*.stories.*`, e os arquivos do próprio serviço (`packages/model/src/units*.ts`). Conta, por arquivo, linhas que casam com **qualquer** destes padrões:
   - `\.toFixed\(`
   - `toLocaleString\(|Intl\.NumberFormat`
   - `\.replace\(\s*['"]\.['"]\s*,\s*['"],['"]\s*\)` (troca ponto por vírgula)
   - literais com `m²`, `m³` ou `R\$`
   - atributos JSX `unit="(m|cm|mm|m²|°|%)"` e `scale=\{\s*(100|1000)\s*\}`
2. Uma linha é **isenta** se ela ou a anterior contém `// units-ok: <motivo>` (ou `{/* units-ok: <motivo> */}` em JSX). Motivos válidos: formato de máquina (coordenada SVG/DXF/IFC), identificador, porcentagem de progresso, pixel, dado de depuração. **Nunca** valor que o usuário lê como medida do projeto.
3. Linha de base: `scripts/units-baseline.json` = `{ "caminho/do/arquivo.ts": contagem }` gerado por `node scripts/check-units.mjs --update` (só o agente roda `--update`, e apenas para **reduzir**). Regras do script: falha se um arquivo tiver contagem **maior** que a base ou se um arquivo novo tiver contagem > 0; imprime aviso (não falha) se a contagem **diminuiu** e a base ainda não foi atualizada; `--report` lista totais por pacote.
4. Para formatos de máquina (coordenadas), crie em `packages/geom/src/numberText.ts` o helper `machineNumber(v: number, digits = 3): string` (ponto decimal, sem zeros inúteis, `-0`→`0`) com teste, e use-o no lugar de `toFixed` nesses casos (assim não precisa de isenção).
5. Acrescente ` && node scripts/check-units.mjs` ao final do script `lint` do `package.json` (única edição permitida nesse arquivo; veja a regra 12 do LEIA-ME). Depois confirme que `npm run lint` roda a trava.
6. Teste do script: fixtures em `scripts/__fixtures__/check-units/` e um teste vitest em `scripts/check-units.test.ts` (se vitest não cobrir `scripts/`, crie o teste em `packages/model/src/` que chama a função exportada do script; **exporte** a função de varredura do `.mjs` e use `import`).
Commit: `chore(unidades): C0 trava check-units com linha de base`.

## Tabela de decisão: qual grandeza usar
| O que é | Grandeza |
|---|---|
| Comprimento de parede, linha, vão, largura/altura de porta e janela, altura de peitoril, pé-direito, elevação de nível, dimensões de ambiente, deslocamento, distância, raio, passo da malha, tamanho de vista | `length` |
| Espessura (parede, camada, laje, piso, perfil, batente, alizar, vidro), folga, tolerância de junção, recuo, sobreposição, bitola | `smallLength` |
| Área de ambiente/piso/laje/telhado/vidro/pintura | `area` |
| Volume de concreto/escavação/ambiente | `volume` |
| Ângulos de rotação, de abertura da folha, de arco | `angle` |
| Inclinação de telhado/rampa/laje | `slope` |
| Custos e preços | `currency` |
Se estiver em dúvida entre `length` e `smallLength`, use o que a maioria dos campos vizinhos usa; **espessura é sempre `smallLength`**.

## Procedimento por lote (repita para cada lote abaixo)
1. `node scripts/check-units.mjs --report` e abra os arquivos do lote (`Grep` nos padrões da C0).
2. Para cada ocorrência, classifique pela tabela e substitua:
   - **Campo editável** (`NumField`/similar com `unit`, `scale`, `decimals`): troque por `quantity="..."` e converta `value`/`onChange` para **metros** (remova qualquer `* 100`, `/ 100`, `* 1000`). Confira `min`/`max`/`step`: sempre em metros.
   - **Texto de leitura em React**: `const fmt = useFormat();` e `fmt('length', v)`.
   - **Texto gerado fora do React** (tools, engine, render): receba `units: ResolvedUnits` como parâmetro (obtido de `unitsOf(project)` por quem chama) e use `formatQuantity`. **Não** use estado global. Ajuste os chamadores e os tipos.
   - **Formato de máquina**: `machineNumber` do `geom`.
3. Atualize os testes. Teste que falha porque o formato mudou (ex.: `1.5` → `1,50 m`) é atualizado **depois de conferir** que o valor novo está correto nas unidades padrão. Acrescente, por lote, **pelo menos um teste com unidades não padrão** (ex.: `length: cm`, `area: ft2`) provando que o texto acompanha.
4. `node scripts/check-units.mjs --update` (a base só diminui) e o checklist de verificação (regra 8 do LEIA-ME).
5. Commit por lote: `refactor(unidades): C<n> <lote>`; push; marcar em seu arquivo de progresso (`PROGRESSO-<PAPEL>.md`).

## Lotes (nesta ordem)
- **C1**: painel de propriedades — `apps/web/src/ui/Properties.tsx`, `*Properties.tsx` (parede, piso, laje, telhado, ambiente, forro, escada, grade, anotação), `PlacementProperties.tsx`, `ToolTypeProps.tsx`, `TypeRow.tsx`, `TypePreview.tsx`.
- **C2**: diálogos — `apps/web/src/ui/dialogs/**` (tipos de parede/camadas, tipo de abertura e `openingType/**`, níveis, materiais, quadros), `browser/**`, `perimeter/**`.
- **C3**: barras e chrome — `OptionsBar.tsx` e `*OptionsBar.tsx`, `StatusBar.tsx`, `Ribbon.tsx`, `NavBar.tsx`, `ViewControlBar.tsx`, `InfoCenter.tsx`, `PlanLabels.tsx`, `SheetView.tsx`, `SectionViewProps.tsx`, `SectionCanvas.tsx`, `ViewportOverlays.tsx`.
- **C4**: `packages/tools` — mensagens de status e rótulos de prévia com valores (`formatMeters` em `openingPlacement.ts` e todos os usos, `dimensionTool.ts`, `wallTool.ts`, `perimeter*.ts`, `stair*.ts`, `roof*.ts`, `slab*.ts`, `floor*.ts`, `offsetTool.ts`, `arrayTool.ts`, `lengthEdit.ts`, `numeric.ts`). Entrada digitada em ferramentas (comprimento/offset/espaçamento) passa a usar `parseQuantityText`. `formatMeters` deixa de existir (apague e ajuste os chamadores; os testes de `openingPlacement` são atualizados).
- **C5**: `packages/model` e `packages/engine` — textos gerados:
  - `dimension.ts` (`dimensionText`, linhas 49–53 aproximadamente): passa a receber `units: ResolvedUnits`. Regra: `Dimension.unit` **ausente ou `'project'`** → usa unidade e casas decimais de `length` do projeto; `unit` explícito (`'m'|'cm'|'mm'`, dados antigos) → mantém essa unidade via `FormatOptions.unit`. Acrescente `'project'` à união de `Dimension.unit` (campo opcional, sem migração). `precision` ausente → casas do projeto. `suffix`/`prefix` continuam valendo.
  - `autoCotas.ts` e quem cria `Dimension` nas ferramentas: **parem de gravar `unit`/`precision` fixos** (deixe ausente para seguir o projeto).
  - Quantitativos, quadro de esquadrias, rótulos de ambiente (área/perímetro), rótulos de nível, escala/folhas: usar `formatQuantity`.
  - Rótulo de abertura/tipo com dimensões (ex.: "0,80 × 2,10"): `formatQuantity(units,'length',…,{withUnit:false})`.
- **C6**: `packages/render` e `packages/io` — textos desenhados (cotas, rótulos, legendas, cabeçalhos de folha), exportação de quadros (CSV/XLSX/PDF) e DXF/IFC. **Dados de máquina não mudam** (coordenadas, `$INSUNITS`, `METRE`). Textos legíveis pelo usuário usam as unidades do projeto: o contexto de render/exportação recebe `units`.
- **C7 (fecho)**: (a) remova as props `unit`, `scale`, `decimals` deprecadas do `NumField` e dos demais campos; o compilador aponta os usos restantes; (b) `node scripts/check-units.mjs --report` deve mostrar **0**, ou só linhas com `units-ok` justificadas; (c) apague `units-baseline.json` se vazio e deixe o script falhar em qualquer ocorrência; (d) escreva `docs/decisoes/` uma decisão curta "Unidades do projeto" (formato dos arquivos vizinhos: leia um antes) com as regras da Fase A.

## Armadilhas conhecidas
- Campos com `scale={100}` hoje mostram **cm** e gravam metros. Ao migrar, escolha `smallLength` (padrão cm) ou `length` conforme a tabela; o valor guardado não muda.
- `parseNumber` antigo aceita vírgula e ponto; o novo também. Não regrida isso.
- Rótulos dentro de canvas/SVG no `render` são desenhados com a fonte do app: o texto novo (com unidade) pode ser mais longo; confira cortes/sobreposição nos rótulos de cota e ambiente.
- Cache: `resolveLevel` e afins têm cache por projeto. **Texto de unidade não pode entrar em geometria cacheada.** Se uma geometria cacheada carrega texto formatado, mova a formatação para o ponto de desenho.
- Desempenho: `formatQuantity` é chamado em laço de desenho; mantenha-o sem alocar objetos além da string (nada de `Intl.NumberFormat` por chamada).
- Testes de imagem/goldens (`tests/e2e/baseline*`): não regrave; anote em seu arquivo de progresso (`PROGRESSO-<PAPEL>.md`) quais seriam afetados.
