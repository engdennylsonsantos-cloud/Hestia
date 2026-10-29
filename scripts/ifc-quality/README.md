# Qualidade da exportação IFC

Harness independente para medir a exportação — nada aqui faz parte do produto.

## Comandos

```powershell
# 1. Exporta os modelos de partida (data fixa) para test-results/ifc-quality/
npx vite-node scripts/ifc-quality/export-fixtures.mts

# 2. Valida com o IfcOpenShell (schema, contagens; --geometry mede volume/área)
python scripts/ifc-quality/validate.py test-results/ifc-quality/house2.ifc
python scripts/ifc-quality/validate.py test-results/ifc-quality/house2.ifc --geometry

# 3. Ida e volta: modelo → IFC → importação → assinatura canônica
npx vite-node scripts/ifc-quality/roundtrip.mts          # relatório (não falha)
npx vite-node scripts/ifc-quality/roundtrip.mts --strict  # falha em divergência (gate da onda 1+)

# 3b. N2 (geometria): quantitativos do motor × volume/área medidos pelo IfcOpenShell, por categoria
npm run ifc:compare             # tabela + test-results/ifc-quality/compare.json (só relata)
npm run ifc:compare -- --strict # gate: falha com volume > 0,5 % ou área > 1 %

# 4. Testes rápidos do exportador (sem a suíte inteira)
npm run test:ifc-export
```

## O que cada script garante

- `export-fixtures`: determinismo (mesma data → mesmo texto), cobertura dos templates.
- `validate.py`: `ifcopenshell.validate` (schema), contagem por classe, volume/área por produto com `ifcopenshell.geom`.
- `roundtrip`: níveis, contagens por `kind` e espessuras de parede na ida e volta. `--strict` é o gate.
- `compare`: fecha o N2 (geometria). Exporta os mesmos modelos (`projectIfc` com data fixa, arquivos idênticos aos do
  `export-fixtures`), mede cada produto no IfcOpenShell e soma por categoria para comparar com o motor: paredes
  (`quantifyLevel`, `grossVolume` × `IFCWALL`), pisos/lajes/forros (`quantifyFloors`/`quantifySlabs`/`quantifyCeilings` ×
  `IFCSLAB` FLOOR/BASESLAB e `IFCCOVERING`), telhados (`quantifyRoofs` × `IFCSLAB` .ROOF., sem contar o `IFCROOF` duas
  vezes), escadas (`stairQuantities` × `IFCSTAIRFLIGHT` + `IFCSLAB` .LANDING.) e ambientes (`room.area`/`room.volume` ×
  `IFCSPACE`). O vínculo é o GlobalId determinístico (`ifcGuid`). Tolerâncias: volume 0,5 %, área 1 %; categoria sem
  dado no motor é ignorada. Produto esperado que o IfcOpenShell não mediu também reprova a linha.

## Lacunas conhecidas (onda 2)

- N2 (geometria) ainda acusa divergências conhecidas em `ifc:compare --strict`: paredes −0,4% a −0,9% (vão bruto ×
  retorno de acabamento), pisos/lajes do `predio10` (região da junção × volume líquido do quantitativo) e escadas
  +3% (a chegada entra no lance do IFC e fica fora do `stairQuantities`). Ambientes, telhados e paredes sem vão batem.
- Forros ainda não são escritos (`IfcGeometry` não tem `ceilings`); quando entrarem, o comparador acusa.
- A comparação N2 é **relatório** no `ifc:quality`; o gate estrito é `npm run ifc:compare -- --strict`.

## Requisitos

- Node 20+ e `ifcopenshell` 0.8.x no Python (`python -c "import ifcopenshell"`).
- Nada é enviado para a nuvem; validação local.
