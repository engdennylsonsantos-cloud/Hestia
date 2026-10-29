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
| N2 geométrico | volume/área contra o motor; sem faltar/sobrar elemento | `ifcopenshell.geom` |
| N3 visual | cor/opacidade e 3D equivalentes | Bonsai/Blender + captura |
| N4 round-trip | JSON canônico idêntico (exceto timestamp) | `roundtrip.mts --strict` |
| N5 interop | Revit, ArchiCAD, Bonsai, Solibri abrem e medem igual | matriz manual + CI |

## Arquitetura

1. **Serializador determinístico**: mesmos ids, mesma ordem, mesmo texto para a mesma entrada e data.
2. **Estrutura espacial**: Project → Site → Building → Storey, `RelContainedInSpatialStructure`,
   `RelAggregates` (telhado→águas, escada→lances).
3. **Tipos e camadas**: `IfcMaterialLayerSet` + `IfcMaterialLayerSetUsage` (offset da linha de locação) para parede,
   piso, laje, forro e telhado; `IfcSurfaceStyle` com cor e `Transparency`.
4. **Vãos**: `IfcOpeningElement` + `RelVoidsElement`; `IfcDoor`/`IfcWindow` + `RelFillsElement`, com tipo,
   `OverallWidth/Height`, `OperationType`, `PartitioningType`.
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

**Onda 2 — 4 lanes**
F: materiais/cores/transparência de todos os nativos. G: georreferência/unidades/determinismo/tamanho.
H: correções de interoperabilidade Revit/ArchiCAD. I: regressão visual, docs e CI.

## Comandos

```powershell
npx vite-node scripts/ifc-quality/export-fixtures.mts
python scripts/ifc-quality/validate.py test-results/ifc-quality/house2.ifc --geometry
npx vite-node scripts/ifc-quality/roundtrip.mts --strict
npm run test:ifc-export
```
