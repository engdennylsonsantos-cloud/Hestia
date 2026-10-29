# Resultado do teste de ida e volta das cotas dinâmicas

`packages/tools/src/dims/roundtrip.test.ts`, `roundtripLineGrid.test.ts` e `roundtripSupport.ts`
(branch `claude/fervent-newton-rfgz3y`, 2026-10-29).

**248 cenários**: 218 passam e 30 documentam defeitos reais com `it.fails` no bloco
`pendentes de correção (PARALELAS)`. Cada cenário lê `m0`, edita para `m0+0,5`, `m0−0,3` (se válido),
`3,00` e `m0`, aplica os comandos no `ProjectStore` e remede a mesma cota com tolerância de 1e-6;
também confere que nenhum outro elemento mudou e, nas translações, que o comprimento do elemento
não mudou. Ângulos: 0°, 45°, 90°, 180° e 270°.

## Passam

| Provedor | Variante | Referência | 0° | 45° | 90° | 180° | 270° |
|---|---|---|---|---|---|---|---|
| parede | ponta até perpendicular | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `finish` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `coreCenter` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `coreFace` | ✅ | ✅ | ✅ | ✅ | ✅ |
| linha de detalhe | comprimento | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |

Esquadria (porta e janela, lados esquerdo e direito, 5 ângulos cada): todas as 4 referências de
parede × 4 referências de esquadria passam nos 5 ângulos.

| parede \ esquadria | `center` | `clear` | `frame` | `casing` |
|---|---|---|---|---|
| `axis` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `finish` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `coreCenter` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `coreFace` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |

## Falham (pendentes de correção — PARALELAS)

Caso do dono: duas grades a 1,64 m; digitar **3,00 m** na cota deixa a distância em **0,28 m**
(`2·d − v = 2×1,64 − 3,00`). A translação vai no sentido do outro elemento em vez de afastar.

| Provedor | Variante | Referência | 0° | 45° | 90° | 180° | 270° |
|---|---|---|---|---|---|---|---|
| parede | distância até paralela | `axis` | ❌ | ❌ | ❌ | ❌ | ❌ |
| parede | distância até paralela | `finish` | ❌ | ❌ | ❌ | ❌ | ❌ |
| parede | distância até paralela | `coreCenter` | ❌ | ❌ | ❌ | ❌ | ❌ |
| parede | distância até paralela | `coreFace` | ❌ | ❌ | ❌ | ❌ | ❌ |
| grade | paralela à direita | `axis` | ❌ | ❌ | ❌ | ❌ | ❌ |
| grade | paralela à esquerda | `axis` | ❌ | ❌ | ❌ | ❌ | ❌ |

Valores esperados × obtidos ao digitar 3,00 m (`m0` é a distância inicial):

| Provedor / referência | `m0` | Esperado | Obtido |
|---|---|---|---|
| grade / `axis` | 1,64 | 3,00 | 0,28 |
| parede / `axis` e `coreCenter` | 1,64 | 3,00 | 0,28 |
| parede / `finish` | 1,456 | 3,00 | 0,088 |
| parede / `coreFace` | 1,50 | 3,00 | sem cota (as faces coincidem) |

Causa: em `providers/wall.ts` (`gapDim`) o deslocamento é `value − gap.distance` e em
`providers/grid.ts` é `gap.side * value − gap.signed`; os dois deveriam inverter o sinal
(`gap.distance − value` e `gap.signed − gap.side * value`). Quando corrigido, trocar os
`it.fails` por `it` e remover o `describe` de pendentes.

## Excluídos explicitamente (somente leitura, por projeto)

Não há ida e volta a medir; o teste confere que `edit` está ausente, em todos os ângulos:

- **Perímetro** — a digitação do comprimento vive na sessão da ferramenta (`perimeterToolInput.ts`).
- **Contorno de piso/laje/forro/telhado** — `outlineEdit.ts` ainda não oferece operação pura de comprimento.
- **Deslocamento (mover/copiar)** — a ferramenta já lê o valor digitado; a cota é só leitura e o
  provedor não tem `selectionSubject`.
