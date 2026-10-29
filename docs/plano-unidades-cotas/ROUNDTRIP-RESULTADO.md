# Resultado do teste de ida e volta das cotas dinâmicas

`packages/tools/src/dims/roundtrip.test.ts`, `roundtripLineGrid.test.ts` e `roundtripSupport.ts`
(branch `claude/fervent-newton-rfgz3y`, 2026-10-29).

**253 cenários, todos verdes.** Cada cenário lê `m0`, edita para `m0+0,5`, `m0−0,3` (se válido),
`3,00` e `m0`, aplica os comandos no `ProjectStore` e remede a mesma cota com tolerância de 1e-6;
também confere que nenhum outro elemento mudou e, nas translações, que o comprimento do elemento
não mudou. Ângulos: 0°, 45°, 90°, 180° e 270°.

Durante a integração, esta rede apontou o defeito do relato do dono (30 casos de parede e grade com
`it.fails`). O PARALELAS corrigiu em `8aacd1e` e os `it.fails` foram trocados por `it` normais.

## Passam

| Provedor | Variante | Referência | 0° | 45° | 90° | 180° | 270° |
|---|---|---|---|---|---|---|---|
| parede | ponta até perpendicular | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `finish` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `coreCenter` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | ponta até perpendicular | `coreFace` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | distância até paralela | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | distância até paralela | `finish` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | distância até paralela | `coreCenter` | ✅ | ✅ | ✅ | ✅ | ✅ |
| parede | distância até paralela | `coreFace` | ✅ | ✅ | ✅ | ✅ | ✅ |
| linha de detalhe | comprimento | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| linha de detalhe | distância até paralela | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| grade | paralela à esquerda | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| grade | paralela à direita | `axis` | ✅ | ✅ | ✅ | ✅ | ✅ |

Esquadria (porta e janela, lados esquerdo e direito, 5 ângulos cada): todas as 4 referências de
parede × 4 referências de esquadria passam nos 5 ângulos.

| parede \ esquadria | `center` | `clear` | `frame` | `casing` |
|---|---|---|---|---|
| `axis` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `finish` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `coreCenter` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| `coreFace` | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |

## Regressão do relato do dono (agora coberta)

Duas grades a 1,64 m: digitar **3,00 m** na cota agora remede **3,00 m** (tolerância 1e-6), em vez de
`2·d − v = 0,28 m`. O mesmo vale para a parede até a paralela em todas as referências (antes:
`axis`/`coreCenter` 0,28 m, `finish` 0,088 m e `coreFace` fazia a cota desaparecer).

## Excluídos explicitamente (somente leitura, por projeto)

Não há ida e volta a medir; o teste confere que `edit` está ausente, em todos os ângulos:

- **Perímetro** — a digitação do comprimento vive na sessão da ferramenta (`perimeterToolInput.ts`).
- **Contorno de piso/laje/forro/telhado** — `outlineEdit.ts` ainda não oferece operação pura de
  comprimento; a cota mostra a distância entre lados paralelos.
- **Deslocamento (mover/copiar)** — a ferramenta já lê o valor digitado; a cota é só leitura e o
  provedor não tem `selectionSubject`.
