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

# 4. Testes rápidos do exportador (sem a suíte inteira)
npm run test:ifc-export
```

## O que cada script garante

- `export-fixtures`: determinismo (mesma data → mesmo texto), cobertura dos templates.
- `validate.py`: `ifcopenshell.validate` (schema), contagem por classe, volume/área por produto com `ifcopenshell.geom`.
- `roundtrip`: níveis, contagens por `kind` e espessuras de parede na ida e volta. `--strict` é o gate.

## Lacunas conhecidas (onda 1)

- `IfcSpace` e `IfcGrid` ainda não saem; ambientes/eixos se perdem na ida e volta.
- Telhado e escada voltam como genérico (o importador ainda não os reconstrói nativamente).
- Pisos/lajes/forros voltam sem a distinção fina de `PredefinedType` em alguns casos.
- Psets/qsets dos nativos ainda não são exportados; a comparação exata (`Pset_Hestia_Element`) entra na onda 1.

## Requisitos

- Node 20+ e `ifcopenshell` 0.8.x no Python (`python -c "import ifcopenshell"`).
- Nada é enviado para a nuvem; validação local.
