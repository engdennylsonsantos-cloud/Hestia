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

# 3b. N2 (geometria): geometria EXPORTADA (`ifcGeometryOf`) × volume/área medidos pelo IfcOpenShell
npm run ifc:compare             # tabela + test-results/ifc-quality/compare.json (só relata)
npm run ifc:compare -- --strict # gate: falha com volume > 0,5 % ou área > 1 %

# 4. Ciclo completo: exporta, valida, round-trip e `compare --strict` (gate do N2)
npm run ifc:quality

# 5. Testes rápidos do exportador (sem a suíte inteira)
npm run test:ifc-export
```

## O que cada script garante

- `export-fixtures`: determinismo (mesma data → mesmo texto), cobertura dos templates.
- `validate.py`: `ifcopenshell.validate` (schema), contagem por classe, volume/área por produto com `ifcopenshell.geom`.
- `roundtrip`: níveis, contagens por `kind` e espessuras de parede na ida e volta. `--strict` é o gate.
- `compare`: fecha o N2. Exporta os mesmos modelos (`projectIfc` com data fixa, arquivos idênticos aos do
  `export-fixtures`), mede cada produto no IfcOpenShell e compara com **a geometria resolvida que o exportador
  recebeu** (`ifcGeometryOf(projeto)`, a mesma entrada do `projectIfc`), produto a produto pelo GlobalId determinístico
  (`ifcGuid`). Produto esperado que o IfcOpenShell não mediu (sem corpo ou com erro de geometria) reprova a linha.
- `quality`: roda a exportação, a validação, o round-trip e, **depois**, o `compare --strict`. Se o N2 falhar, imprime a
  tabela do comparador e sai com erro. O `compare.json` vai inteiro para o `report.json` (`n2`, com `n2Ok`).

## N2 — geometria exportada × IFC

O par é o sólido que o exportador escreveu, dos dois lados: o esperado sai de `ifcGeometryOf(projeto)` com as mesmas
fórmulas do `packages/io/src/ifc/ifcSolids.ts`; o medido é o volume/área que o `validate.py --geometry` devolve por
produto. Fórmula por categoria (m³, salvo indicado):

| categoria | GlobalId | esperado |
|---|---|---|
| paredes | `wall:<id>` | Σ footprints (união das camadas, área do polígono com furos) × `height`, **menos** as caixas de vão (`geo.openings`: `roughWidth` × `thickness` × `roughHeight`) recortadas pela altura da parede e pela interseção em planta com o footprint — é o que o `IFCRELVOIDSELEMENT` tira do corpo do IFCWALL |
| pisos | `floor:<id>` | Σ prismas de `geo.floors` (região da junção) — volume exato do prisma |
| lajes | `slab:<id>` | Σ prismas de `geo.slabs` (topo/fundo podem ser inclinados) |
| forros | `ceiling:<id>` | Σ prismas de `geo.ceilings` (IFCCOVERING .CEILING.) |
| telhados | `roofslab:<id>:<água>` | Σ `geo.roofs[].planes`, uma IFCSLAB .ROOF. por água (o IFCROOF não tem corpo) |
| escadas | `flight:<id>:<lance>`, `landing:<id>:<patamar>` | Σ peças de cada lance e cada patamar de `geo.stairs` — a chegada entra, porque o exportador a escreve |
| ambientes | `space:<id>` | `resolveRooms` como o `ifcSpaces.ts`: área do contorno resolvido (com furos) × `ceilingHeight`; a área esperada é a área do contorno e a medida é o volume do IFCSPACE ÷ pé-direito |

Volume de um `IfcPrism` (topo e fundo planos `z = a·x + b·y + c`): `∫(topo − fundo) dA = (c_t − c_b)·A + (a_t − a_b)·∫x dA +
(b_t − b_b)·∫y dA`. Para prisma de cota constante vira área × espessura; para telhado e para as peças da escada
monolítica (fundo inclinado) a mesma fórmula é exata. O filtro do `prismsShape` é espelhado: prisma sem contorno válido,
ou de cota constante com topo ≤ fundo, não é escrito e vale 0.

Tolerâncias: volume 0,5 %, área 1 % (área só nos ambientes; nos demais o `area` do IfcOpenShell é a superfície total do
sólido, não uma grandeza de projeto). Categoria sem geometria esperada é ignorada (não conta como falha).

**Resultado atual**: 16 totais comparados, 0 fora da tolerância; todos os deltas ficam em ±0,00 % (o `predio10` mede
693,027 m³ de paredes, 52,881 m³ de pisos, 499,345 m³ de lajes e 23,747 m³ de escadas). Não houve resíduo de
tesselação: o IfcOpenShell devolve o mesmo volume dos sólidos planos escritos, então as tolerâncias continuam em
0,5 %/1 % (nenhum ajuste para 0,1–0,2 % foi necessário).

## Quantitativos do motor — informação, não gate

O `compare.json` guarda em `modelos.<nome>.motor` os quantitativos **semânticos** do motor (`quantifyLevel`,
`quantifyFloors`, `quantifySlabs`, `quantifyCeilings`, `quantifyRoofs`, `stairQuantities`, `resolveRooms`). Eles NÃO são
o par da exportação: descontam piso/laje, vão + retorno de acabamento e deixam a chegada da escada de fora, então
divergem do IFC por projeto, não por exportação. Servem para acompanhar o motor, e é onde aparece o bug conhecido:

- **`predio10` pisos**: o quantificador de piso do motor descontava o volume coberto pela laje e devolvia ~0,13 m³ nos
  pavimentos superiores (36,436 m³ no total, contra 52,881 m³ do piso inteiro que o IFC exporta). É divergência do
  **motor**, não do exportador — a geometria exportada bate com o IFC. O número em `motor.pisos` muda conforme a lane do
  motor corrige o quantificador; o N2 não depende dele.
- **Paredes**: o motor desconta vão + retorno de acabamento; o IFC desconta só o vão bruto (por isso o antigo N2 media
  −0,4 % a −0,9 %). **Escadas**: o `stairQuantities` não conta a chegada que o IFC escreve (+3 % no antigo N2).

## Lacunas conhecidas (onda 2/3)

- `IfcGeometry` não tem `spaces`: os ambientes são comparados com `resolveRooms` (o mesmo que o `ifcSpaces.ts` usa hoje);
  quando a geometria de ambientes vier do exportador, o comparador passa a ler `geo.spaces`.
- Parede com `topProfile` (perfil superior editado): o exportador troca a extrusão pelo perfil longitudinal; o
  comparador usa a extrusão de altura constante. Nenhum modelo de qualidade usa `topProfile` hoje.
- `compare` reexporta os mesmos fixtures do `export-fixtures` (mesma data e mesmo projeto); manter os dois arquivos
  iguais é requisito para o `casa-ambientes.ifc` ser o mesmo nos dois passos.
- O round-trip ainda tem lacunas conhecidas (onda 1) e é só relatório no `ifc:quality`; o gate estrito é o N2.

## Requisitos

- Node 20+ e `ifcopenshell` 0.8.x no Python (`python -c "import ifcopenshell"`).
- Nada é enviado para a nuvem; validação local.
