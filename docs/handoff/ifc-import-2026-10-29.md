# Retomada — importação IFC (2026-10-29)

Documento de ponto de parada da frente de **importação IFC**, escrita para continuar em outra máquina/sessão. Tudo o que
está descrito aqui está commitado no branch **`feat/ifc-import`** (7 commits sobre `perf/gpu-port` em `origin`).

- Commits: `e1d389a1` → `5a92a495` → `165eab77` → `9c9d64c8` → `44076adf` → `e6ca8f00` → `d9bdeb4e`
- Base: `perf/gpu-port` (`5f00d0b3`)
- Nada foi mesclado na `perf/gpu-port` nem enviado para `main`.

> **Atenção ao retomar:** a árvore de trabalho pode conter alterações **de outra sessão** em escadas/zoom
> (`packages/engine/src/sectionStairs*`, `stairOpenings*`, `packages/render/src/plan/stairs*`,
> `packages/render/src/plan/ouroZoom.json`, `packages/tools/src/stairRun*`, `packages/render/src/model3d/scene3d.ts`).
> Elas **não** fazem parte deste trabalho: não commitar junto, não reverter. O teste `ouroZoom.test.ts` falha enquanto o
> `ouroZoom.json` estiver no meio da mudança da outra sessão.

> **Atualização 2026-10-29 (fallback e níveis):** todo produto que falha no mapeamento nativo agora vira **genérico**
> (parede de forma livre, parede com mais de um sólido, porta/janela sem vão ou sem parede hospedeira, laje/forro sem
> contorno, ambiente sem corpo). Arquivos sem `IfcBuildingStorey` têm os níveis inferidos pelas cotas de parede/laje
> (salto > 1,5 m). Efeito medido no `modelo 01.ifc` (20 MB, fornecido pelo usuário): 245 → **264 elementos** e 1 → **2
> níveis**, com `skipped` vazio. O `sala.ifc` continua 93/93.

---

## 1. O que foi entregue

### 1.1 Leitura e geometria (`packages/io/src/ifcImport/`)

| Arquivo | Papel |
|---|---|
| `step.ts` | Tokenizador/parser STEP (ISO 10303-21): comentários, `''`, `\X2\`, `\S\`, `$`, `*`, tipos, listas; entidade quebrada não derruba o arquivo. |
| `ifc.ts` | `IfcFile` (resolução de refs), unidades (SI com prefixo e conversão para pés/polegadas, ângulo), placements (`IfcLocalPlacement`, `Axis2Placement2D/3D`), matrizes. |
| `profiles.ts` | Perfis: retângulo, círculo, elipse, trapézio, arbitrário com furos, I/U/L/T/Z/C (caixa envolvente), composto, derivado; curvas polyline, indexed, composta, trimmed (reta e arco amostrado). |
| `geometry.ts` | `bodyOf`: extrusão vertical (prisma) e inclinada (triângulos), `MappedItem`, B-rep, face set, tessellation, booleano (primeiro operando), hull e retângulo mínimo para parede. |
| `mapping.ts` | Mapeamento para o modelo do Hestia + relatório; dispatcher. |
| `elementTypes.ts` | Tipos de parede/piso/laje/forro/abertura, material de cor do IFC. |
| `psets.ts` | `IfcPropertySet`/`IfcElementQuantity` e `IfcStyledItem` → `ifcProperties` e `color`. |
| `levels.ts` | `IfcBuildingStorey` → níveis. |
| `index.ts` | API pública (`importIfc`, `parseStep`). |

### 1.2 O que vira elemento nativo

- **Níveis** (`IfcBuildingStorey`, cota do atributo 9 ou do placement).
- **Parede**: extrusão vertical retangular (ou chanfro < 20% da área) → eixo central, espessura, altura, camada de
  estrutura da espessura total; `locationLine = wallCenter`.
- **Porta/janela**: pelo vão (`IfcOpeningElement` + `RelVoidsElement`), host por relação, largura/altura/peitoril do vão,
  família de planta por `OperationType`/`PartitioningType`.
- **Piso/laje/forro**: contorno + furos + espessura; `IfcSlab` (`FLOOR`/`BASESLAB`/`ROOF`/`LANDING`) e `IfcCovering CEILING`.
- **Ambiente**: `IfcSpace` → ponto-semente (centroide).
- **Grade**: `IfcGrid`/`IfcGridAxis` → grades do Hestia.

### 1.3 Objeto genérico (`kind: 'generic'`)

Todo produto sem equivalente nativo vira genérico: **viga, pilar, escada, telhado, guarda-corpo, mobiliário, MEP,
fundação, chapa, curtain wall, proxy**. Guarda `sourceClass`, `predefinedType`, `objectType`, malha triangular em mundo,
contorno em planta (hull), `ifcProperties` e `color`.

- **3D**: `packages/render/src/model3d/genericSolids.ts` — lote por cor (`im_<hex>`) ou concreto, normal plana, faixa de
  índices por elemento (picking/realce).
- **Planta**: contorno tracejado em `packages/render/src/plan/build.ts`; seleção por `genericAt` em
  `packages/tools/src/pick.ts` + `selectTool.ts`.
- **Propriedades**: `apps/web/src/ui/GenericProps.tsx` (classe, nível, triângulos, volume/área, psets).
- **Quantitativos**: `packages/engine/src/genericQuantities.ts` (volume por tetraedros, área por triângulos).
- **DXF**: `packages/io/src/dxfGeneric.ts` (camada `IMPORTADO`, POLYLINE R12, cinza 8).
- **IFC de volta**: `packages/io/src/ifc/ifcGeneric.ts` (`IfcBuildingElementProxy`, `ObjectType` = classe de origem,
  `IfcTriangulatedFaceSet`, psets por conjunto de origem).

### 1.4 Interface e serviço

- **Menu Arquivo → Importar IFC…** (`apps/web/src/ui/FileMenu.tsx`): carrega como `nome.hestia.json`, resumo na faixa e
  na barra de status.
- **Worker**: `apps/web/src/editor/ifcWorker.ts` + `ifcImportText` em `ifcImport.ts` (timeout 120 s, fallback síncrono).
- **CLI**: `npx vite-node scripts/ifc-import.mts <arquivo.ifc> [saida.json]` (grava `<saida>.relatorio.json`).
- **Oráculo**: `node scripts/ifc-oraculo.mjs --todos [--verificar]` (contagens por classe independentes do importador).
- **Benchmark**: `npx vite-node scripts/bench-ifc.mjs [--repeticoes N] [--grandes] [--json]`.

### 1.5 Fixtures

`tests/ifc/fixtures/`: `parede-janela.ifc`, `predio-simples.ifc`, `casa-pequena.ifc`, `fzk-haus.ifc`; manifesto com
SHA256 e licença em `manifest.json`/`README.md`; downloader em `scripts/baixar-ifc.mjs`.
O sample do Revit (25 MB) é opcional: `--grandes`.

---

## 2. Métricas medidas

| Fixture | Importação | Elementos | Objetos | Triângulos | RSS |
|---|---:|---:|---:|---:|---:|
| `parede-janela.ifc` | 9 ms | 2 | 0 | 0 | +0 |
| `predio-simples.ifc` | 19 ms | 14 | 5 | 942 | +0,2 MB |
| `fzk-haus.ifc` (4 MB) | 356 ms | 97 | 57 | 10.576 | +100 MB |
| sample do Revit (25 MB) | 3,99 s | 429 | 329 | 301.458 | +422 MB |

Contagens de referência: FZK 13 paredes / 5 portas / 11 janelas / 3 lajes / 1 piso / 7 ambientes / 57 objetos.

---

## 3. Estado dos testes

- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `npm run lint` — limpo (fronteiras, paridade, densidade).
- `npx vitest run --maxWorkers=6` — **507 arquivos / 5.671 testes** verdes, **excluindo** `packages/render/src/plan/ouroZoom.test.ts`.
  Esse arquivo falha (72 casos) porque o **`ouroZoom.json` está alterado sem commit pela outra sessão**; a rodada anterior,
  com o JSON intacto, passou 508/5757. Ver o aviso no topo.
- `npm run build` — ok; o worker sai como `dist/ifcWorker-*.js`.
- Testes novos da frente: parser (11), importação (12+3), psets (6), genérico (3), DXF (7), IFC de volta (9), quantitativos (6),
  propriedades (3), seleção na planta (3), regressão dos fixtures (36).

---

## 4. Decisões que não devem ser reabertas sem motivo

1. **Ids determinísticos** derivados do `GlobalId` do IFC (`w_`, `o_`, `f_`, `s_`, `c_`, `r_`, `g_`, `g_<guid>` para genérico);
   mesmo arquivo → mesmo `.hestia.json`.
2. **Nativo só quando a geometria cabe exatamente**; o resto vira genérico, nunca descartado calado.
3. **Relatório honesto**: `imported`, `skipped` por classe, `generic`, `approximate`, `geometry`, `warnings`.
4. **Tolerâncias**: tipo por espessura ±1 mm; retângulo de parede aceita até 20% de área fora (chanfro); 5 mm em dimensões.
5. **Unidades**: sempre metro/grau na saída (a malha do genérico e os `ifcProperties` ficam no valor do arquivo — ver §6).
6. **Psets preservam o nome do conjunto** (`Pset_WallCommon`, `Qto_*`); só propriedade antiga sem `pset` cai em `Pset_Hestia`.
7. **Importar substitui o projeto** (não há merge); o IFC original nunca é sobrescrito (vira `.hestia.json`).

---

## 5. Limitações conhecidas e solução viável

| Limitação | Consequência | Solução | Esforço |
|---|---|---|---|
| Telhado/escada são genéricos | Não editáveis como `Roof`/`Stair` nativos | Comando "telhado a partir do contorno" (hull → esboço) e, depois, nativo só para 1–2 águas e lance reto | 2–4 dias / 1–2 semanas |
| Corte booleano ignorado | Parede sobe além do telhado/laje | Cortar prisma por half-space (interseção de polígono com semiplano) | 2–3 dias |
| Worker não inline no artifact único | UI congela ~2–4 s em 25 MB no artifact | Worker como blob inline (`?worker&inline` ou Blob) com detecção de ambiente | 0,5–1 dia |
| Sem merge no projeto atual | Importar substitui o projeto | Fase 1: anexar só genéricos com offset/ids novos; fase 2: merge completo com níveis/tipos/GlobalId | 2–3 dias / 1–2 semanas |
| Psets de nativos não saem no IFC | Round-trip perde `Pset_WallCommon` etc. | Emitir `IfcPropertySet` por elemento nativo em `ifcElements.ts` | 1–2 dias |
| Memória alta (650 MB no Revit 25 MB) | Risco em modelos grandes | Deduplicar vértices e guardar `Float32Array` | 2–4 dias |
| Curvas/arcos e extrusões inclinadas | Viram malha/genérico ou aproximação | Manter; telhado em arco nativo é decisão de produto | — |

---

## 6. Próximo passo: nuvem

O objetivo declarado é resolver a importação **em nuvem**. Hoje o caminho é 100% browser (worker + WASM-free). Há três
desenhos viáveis; o mapeamento, o relatório, o oráculo e os testes **permanecem** em qualquer um deles.

### Opção A — web-ifc no worker (recomendada para começar)

- Substitui **só** `step.ts` + `geometry.ts` por web-ifc (WASM, MPL-2.0, IFC2x3/4/4.3, malhas + propriedades).
- `mapping.ts` continua montando parede/vão/piso/ambiente/genérico a partir das malhas e relações.
- Prós: roda no navegador, cobre geometria difícil (B-rep, sweeps, CSG), melhora IFC4.3.
- Contras: +1–2 MB de WASM no bundle/worker; artifact de arquivo único precisa de WASM inline; memória maior.
- Esforço: 3–5 dias de integração + 1–2 semanas de adaptação/regressão.

### Opção B — IfcOpenShell em servidor

- Backend Python (FastAPI) recebe o `.ifc`, lê com IfcOpenShell, devolve **malhas + relações + psets** em JSON; o
  mapeamento pode rodar no servidor (Node/TS) ou no cliente.
- Prós: cobertura máxima, validação, IFC4.3, modelos de 100 MB+, cache por hash.
- Contras: deixa de ser estático/offline; custo de infraestrutura; LGPL exige cuidado na distribuição.
- Contrato sugerido: `POST /ifc` → `{ schema, units, entities: [{globalId, class, psets, mesh|prism}], report }` ou o
  `.hestia.json` já pronto + relatório.
- Esforço: 1–2 semanas (infra + contrato + fila + testes).

### Opção C — híbrida

- Cliente tenta web-ifc; se o arquivo for grande/complexo (ou schema 4.3), envia para o servidor.
- Melhor UX e custo controlado; mais código de roteamento.
- Esforço: soma de A + B, com ~3 dias de orquestração.

**Recomendação:** começar por **A** (mantém offline e valida o mapeamento com geometria melhor); migrar para **B** quando
entrar requisito de modelos muito grandes, validação formal ou múltiplos usuários. Em qualquer caso, preservar:
`mapping.ts`, `report`, `tests/ifc/regressao.test.ts`, `scripts/ifc-oraculo.mjs` e os fixtures.

---

## 7. Como retomar (checklist)

```powershell
git fetch origin
git checkout feat/ifc-import
npm ci
npx tsc -p tsconfig.json --noEmit
npm run lint
npx vitest run packages/io/src/ifcImport tests/ifc --maxWorkers=2
npx vite-node scripts/ifc-import.mts tests/ifc/fixtures/fzk-haus.ifc "$env:TEMP/fzk.json"
node scripts/ifc-oraculo.mjs --todos --verificar
```

1. Conferir se as alterações de escada/zoom da outra sessão já foram commitadas; se sim, rodar a suíte completa
   (`npx vitest run --maxWorkers=6`) e comparar com 507/5671 (sem `ouroZoom`).
2. Escolher a opção de nuvem (§6) e abrir um branch `feat/ifc-cloud`.
3. Definir o contrato de entrada/saída antes de codar (mesmo `ImportReport`, mesmos fixtures).
4. Só depois atacar as limitações da §5, na ordem: corte por plano → psets nativos → worker inline.

## 8. Arquivos-chave

- API: `packages/io/src/ifcImport/index.ts` (`importIfc`)
- Modelo: `packages/model/src/types.ts` (`Generic`, `IfcProperty`)
- 3D: `packages/render/src/model3d/genericSolids.ts`; cena: `scene3d.ts`
- Planta: `packages/render/src/plan/build.ts`; seleção: `packages/tools/src/pick.ts`
- UI: `apps/web/src/ui/FileMenu.tsx`, `GenericProps.tsx`, `Properties.tsx`; worker: `apps/web/src/editor/ifcWorker.ts`
- Saídas: `packages/io/src/dxfGeneric.ts`, `packages/io/src/ifc/ifcGeneric.ts`
- Docs: `docs/ifc/importacao.md` (estado, limites, benchmark)
