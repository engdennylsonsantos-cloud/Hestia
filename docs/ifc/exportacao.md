# Exportação IFC — plano de qualidade

Objetivo: o IFC exportado representa o projeto do Hestia com a maior fidelidade possível, e o round-trip
Hestia → IFC → Hestia é exato. Fora do Hestia, a fidelidade é **medida por tolerância**, porque IFC é um modelo de
intercâmbio: cada programa reconstrói tipos, juntas e pranchas à sua maneira.

## Dois contratos

| Contrato | Garantia | Como |
|---|---|---|
| **A. Round-trip Hestia** | Exato: ids, tipos, camadas, juntas, parâmetros | `Pset_Hestia_Element` / `Pset_Hestia_Project` com o registro nativo em JSON + GlobalIds determinísticos |
| **B. Consumo externo** | Fiel dentro de tolerância (volume ±0,5%, área ±1%, contagens exatas) | IFC4 válido, tipos/camadas, vãos por relação, `Qto_*`, cores/opacidade, georreferência |

## Níveis de qualidade (gate)

| Nível | Critério | Ferramenta |
|---|---|---|
| N0 válido | `ifcopenshell.validate` sem erro; refs íntegras; IFC4; metros | `scripts/ifc-quality/validate.py` |
| N1 semântico | elemento no pavimento/tipo certos; vão ligado ao host; material layer set | contagens + psets |
| N2 geométrico | volume/área da geometria exportada; sem faltar/sobrar elemento | `ifcopenshell.geom` |
| N3 visual | cor/opacidade, camadas, espaços e eixos no 3D | [matriz visual](matriz-visual.md) — Any3D + Bonsai, manual |
| N4 round-trip | JSON canônico idêntico (exceto timestamp) | `roundtrip.mts --strict` |
| N5 interop | Revit, ArchiCAD, Bonsai, Solibri abrem e medem igual | matriz manual + CI |

## Arquitetura

1. **Serializador determinístico**: mesmos ids, mesma ordem, mesmo texto para a mesma entrada e data.
2. **Estrutura espacial**: Project → Site → Building → Storey, `RelContainedInSpatialStructure`,
   `RelAggregates` (telhado→águas, escada→lances).
3. **Tipos e camadas**: `IfcMaterialLayerSet` + `IfcMaterialLayerSetUsage` (offset da linha de locação) para parede,
   piso, laje, forro e telhado; `IfcSurfaceStyle` com cor e `Transparency`.
4. **Vãos**: `IfcOpeningElement` + `RelVoidsElement`; `IfcDoor`/`IfcWindow` + `RelFillsElement`, com tipo,
   `OverallWidth/Height`, `OperationType`, `PartitioningType`. O corpo da esquadria é o **modelo único do engine**
   (`buildOpeningModel`): batente, folha, vidro, montantes e maçaneta viram um `IfcExtrudedAreaSolid` cada, e cada peça
   recebe um `IfcStyledItem` com o `IfcSurfaceStyle` do seu material (o vidro mantém a `Transparency` do projeto). O vão
   livre (`leaves: 0`) sai sem corpo (`Representation = $`), porque o furo da parede já é o vão.
5. **Superfícies**: `IfcSlab` com `PredefinedType` correto, furos por `IfcOpeningElement`, telhado como `IfcRoof`
   com águas; escada como `IfcStair` com lances/patamares.
6. **Ambientes e eixos**: `IfcSpace` (extrusão, nome/número, `Qto_SpaceBaseQuantities`); `IfcGrid`/`IfcGridAxis`.
7. **Quantitativos**: `Qto_*` calculados pelo motor (não pela malha).
8. **Psets**: os `ifcProperties` lidos voltam; `Pset_Hestia_Element` carrega `HestiaId`, `HestiaKind`,
   `HestiaType` e `HestiaJSON` (registro nativo sem geometria). No import, se o pset existir, reconstrói sem heurística.
9. **Projeto**: `Pset_Hestia_Project` com `HestiaVersion`, `SchemaVersion`, `SettingsJSON`.
10. **Georreferência**: `IfcSite`/`TrueNorth`; `IfcMapConversion` quando houver CRS; origem local pequena.
11. **Anotações/pranchas**: `IfcAnnotation` quando fizer sentido; prancha não tem padrão IFC — PDF ao lado e metadados.

> **Exceção de camada (2026-10-29):** `packages/io` pode importar `@hestia/engine` **apenas no exportador IFC**, para
> usar os contornos de ambiente e os quantitativos resolvidos (`IfcSpace`, `Qto_*`). O importador e o DXF continuam
> dependendo só de `model`. A regra está em `scripts/check-boundaries.mjs` e em `packages/io/package.json`.

### Resultado da onda 1

- 5 templates + `casa-ambientes` exportam com **0 erros** no IfcOpenShell.
- `IfcSpace` e `IfcGrid` saem (o template sintético `casa-ambientes` comprova 1 ambiente e 1 eixo).
- Pisos/lajes/forros com `PredefinedType`, camadas completas e furos; telhado com águas e escada com lances.
- `Pset_Hestia_*` faz o round-trip exato dos 6 templates (JSON canônico idêntico).
- `ifc:quality` e `roundtrip --strict` são os gates; `test:ifc-export` tem 100 testes.

## O que não é possível prometer

- Que o Revit mantenha as juntas, o intervalo de vista, a prancha e o texto exatamente como no Hestia.
- Que outro programa não reconstrua tipos ou divida paredes.
- Round-trip **através de outro programa** sem perda; o contrato exato vale Hestia → IFC → Hestia.

## Ondas e subagentes (DeepSeek V4.1 Flash)

**Onda 0 — contrato e harness (feita)**
`ifcHestia.ts` (nomes/registro), `scripts/ifc-quality/*`, `tests/ifc-export/*`, `test:ifc-export`.
O harness já achou e corrigiu um erro de schema (`IfcWindowPanelProperties` com 8 atributos em vez de 9).

**Onda 1 — 4 lanes em paralelo**
| Lane | Escopo | Arquivos |
|---|---|---|
| A | paredes/aberturas: camadas, offset, vãos, psets do nativo | `ifcExport.ts`, `ifcElements.ts`, `ifcTypes.ts` |
| B | superfícies: pisos/lajes/forros/telhados/escadas, furos, PredefinedType | `ifcSolids.ts`, novos `ifcSurfaces.ts`, `ifcStairs.ts` |
| C | ambientes, eixos e quantitativos | novos `ifcSpaces.ts`, `ifcGrids.ts`, `ifcQuantities.ts` |
| D | `Pset_Hestia_*` + reconhecimento no import (round-trip exato) | novo `ifcHestia.ts`, `mapping.ts` |

Cada lane roda `tsc` a cada commit e **`npm run test:ifc-export`** ao terminar. A suíte completa é do integrador, 1×
por onda. Integração: o integrador liga as chamadas no `ifcExport.ts`.

**Onda 2 — feita**
F: cores/opacidade/brilho por material (`IfcMaterialDefinitionRepresentation` + `IfcSurfaceStyle`), incluindo vidro das
esquadrias. G: comparação N2 geometria exportada × IfcOpenShell (`scripts/ifc-quality/compare.mts`,
`npm run ifc:compare [-- --strict]`).

**Onda 3 — parcial (2026-10-29)**
Unidades completas (`m`, `m²`, `m³`, `rad`) e **norte verdadeiro** no contexto; **forros** exportados como
`IFCCOVERING .CEILING.` (com camadas e `Qto_CeilingBaseQuantities`); **esquadrias detalhadas** (batente, folha, vidro,
montante, maçaneta) com `IfcStyledItem` por peça e material de fallback na ocorrência — o web-ifc/Any3D deixa de pintar
porta e janela de branco e o vidro fica translúcido; lances de escada recebem o material do tipo. Pendentes: corrigir o
quantificador de piso do `predio10` no motor, decidir o retorno de acabamento do vão, georreferência por CRS, beirais e
espelhos de escada como geometria própria e executar a [matriz visual](matriz-visual.md).

### N2 — geometria exportada × IFC

`ifc:compare` compara a **geometria entregue ao exportador** (`ifcGeometryOf`) com o que o IfcOpenShell mede no
arquivo. Em 2026-10-29: 16 totais, **0 fora da tolerância** (volume 0,5 %, área 1 %); o maior desvio relativo é
0,007 % (`predio10`/paredes) e o resto fica na ordem de 1e-13. O gate estrito (`-- --strict`) pode ser ligado.

Os quantitativos **semânticos** do motor (`quantifyLevel`, `quantifyFloors`, `quantifySlabs`, `quantifyCeilings`,
`quantifyRoofs`, `stairQuantities`) continuam no JSON só como informação (`motor`), porque divergem da geometria
por decisões do motor e não do arquivo:

- **Paredes −0,4 % a −0,9 %**: o motor desconta vão + retorno de acabamento; o IFC desconta só o vão bruto.
- **Escadas +3,1 %**: a peça de chegada entra no `IFCSTAIRFLIGHT` e fica fora do `stairQuantities` (decisão 0012 §2).
- **`predio10` pisos +45 %**: o motor devolve 0,13 m³ nos pavimentos superiores porque o quantificador desconta o
  volume coberto pela laje; o piso exportado coincide com o desenho.
- **`predio10` lajes +2,3 %**: a região exportada avança até o núcleo da parede (P8); o quantitativo não desconta.

Telhados, forros e ambientes batem. Essas diferenças são tarefa de **engine**, não do exportador.

## N3 — matriz visual

O N3 é manual: o arquivo precisa ser aberto num programa de fora e conferido a olho. O procedimento completo
(geração, passos no Any3D/Bonsai/ConstructCAD, checklist, contagens por modelo e formato da captura) está em
[`matriz-visual.md`](matriz-visual.md).

Já validado por script, antes do olho:

- **0 erros** de `ifcopenshell.validate` nos 6 modelos e **round-trip exato** (`roundtripOk: true`);
- **N2 fechado** (16/16 totais dentro da tolerância, geometria exportada × IFC);
- **estilos** por material (`IfcSurfaceStyle` + `IfcMaterialDefinitionRepresentation`, vidro com
  `Transparency = 0,65`), **forros** (`IfcCovering .CEILING.`), **espaços** e **eixos** (`IfcSpace`/`IfcGrid` no
  `casa-ambientes`), telhado de 4 águas e escadas com lances.

Falta o que só o olho fecha: cores/camadas, transparência do vidro, posição dos vãos e árvore espacial em cada
visualizador. As capturas vão para `test-results/ifc-quality/capturas/`.

## Comandos

```powershell
npm run ifc:quality             # exporta + valida + round-trip + N2 (report.json/compare.json)
npx vite-node scripts/ifc-quality/export-fixtures.mts
python scripts/ifc-quality/validate.py test-results/ifc-quality/house2.ifc --geometry
npx vite-node scripts/ifc-quality/roundtrip.mts --strict
npm run ifc:compare             # relatório N2 (geometria exportada × IFC)
npm run ifc:compare -- --strict # gate estrito
npm run test:ifc-export
```
