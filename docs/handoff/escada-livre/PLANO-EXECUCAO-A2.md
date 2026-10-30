# Execução acelerada da A2 — divisão de trabalho

Base: `PLANO-A2-planta-area.md` e `TAREFA-planta-area-somente-leitura.md`.
Objetivo: reduzir o calendário, mantendo a planta de piso intacta e o DXF correto.
Subagentes: somente **Flash** (`opencode-go/deepseek-v4.1-flash`). O agente principal também é Flash.

## Premissas

1. A A1 (`fix/planta-area-sobreposicao-compartilhada`) é integrada na `main` antes de começar a A2. Se não for, as branches abaixo partem da branch da A1.
2. Cada frente trabalha em **worktree própria**, com `node_modules` por junção e `.vite` próprio.
3. O agente principal é dono do caminho crítico (`build.ts`/`types.ts`). Subagente não edita arquivo do caminho crítico ao mesmo tempo.
4. Nenhuma frente mexe em `ouroZoom.json`; se mexer, para e reporta.
5. O merge é sempre do agente principal, em ordem, com teste direcionado antes de cada merge.

## Caminho crítico

```
A2.1 (perfil no piso, sem mudar saída)
   └─> A2.2 (área no motor único)
          ├─> A2.5 (DXF da área)
          ├─> A2.4 (view range/aberturas/testes)
          └─> A2.6 (prancha/viewport)
A2.3 (flags/UI) entra em paralelo depois do A2.1
Somente leitura entra em paralelo desde o dia 1
```

O que **não** paralelizar:

- A2.1 e A2.2 no mesmo `build.ts` — mesmo dono, sequencial.
- Dois subagentes em `packages/render/src/plan/types.ts` — S2 espera o A2.1.
- Dois subagentes em `apps/web/src/editor/dxfExport.ts` — só S3.
- Alterações concorrentes em `areaPlan.test.ts`/`areaPlanOverlay.test.ts` — cada frente cria arquivo novo; ajustes no mesmo teste ficam com o dono da etapa.

## Frentes

| Frente | Dono | Branch | Arquivos principais | Depende de | Duração |
|---|---|---|---|---|---|
| **F0 — somente leitura** | Subagente 1 (Flash) | `fix/planta-area-somente-leitura` | `packages/tools/src/selectTool.ts`, `packages/render/src/plan/planOverlay.ts`, `floors.ts`, `roofs.ts`, `stairs.ts`, `ramps.ts`, `slabs.ts`, `ceilings.ts`, testes | A1 | 0,5–1 dia |
| **F1 — A2.1 perfil no piso** | Agente principal | `feat/planta-area-a2` | `build.ts`, `types.ts`, testes de perfil | A1 | 1,5–2 dias |
| **F2 — A2.2 área no motor único** | Agente principal | `feat/planta-area-a2` (mesma) | `build.ts`, `areaPlan.ts`, `planFrame.ts`, testes da área | F1 | 2–2,5 dias |
| **F3 — A2.3 flags + UI** | Subagente 2 (Flash) | `feat/planta-area-a2-flags` | `packages/model/src/areaPlan.ts`, `packages/render/src/plan/types.ts` (só depois do F1), `AreaPlanProperties.tsx`, `areaPlanActions.ts`, testes | F1 | 1–1,5 dia |
| **F4 — A2.5 DXF** | Subagente 3 (Flash) | `feat/planta-area-a2-dxf` | `apps/web/src/editor/dxfExport.ts`, `areaPlanDxf.test.ts`, `dxfCad.test.ts` | F2 | 1,5–2 dias |
| **F5 — A2.4/A2.6 testes, view range e prancha** | Subagente 4 (Flash) | `test/planta-area-a2-caracterizacao` | `areaPlan.test.ts`, `areaPlanOverlay.test.ts`, `areaPlanSheet.test.ts`, novos testes de view range/aberturas | F2 | 1–1,5 dia |

## Cronograma alvo (5–7 dias)

### Dia 1

- **Principal:** começa F1 (A2.1). Primeiro passo: adicionar `profile?` em `PlanInput` e envolver os blocos do piso sem mudar saída.
- **S1:** executa F0 (somente leitura) na branch própria. Entrega: `select` não move modelo, sem alças de modelo, testes de área atualizados.
- **S4:** prepara a matriz de caracterização (casos de view range, aberturas, escada/rampa/telhado, piso/laje, nível de baixo) **sem editar produção**; deixa os arquivos de teste prontos para rodar quando F2 fechar.

**Gate 1:** `ouroZoom.test.ts` sem diff; testes de F0 verdes.

### Dia 2

- **Principal:** fecha F1 e começa F2.
- **S1:** termina F0, roda testes e deixa o branch pronto para merge.
- **S2:** começa F3 assim que o F1 estiver na branch principal. Trabalha em modelo/UI e deixa o `types.ts` para o final, para minimizar conflito.
- **S4:** segue a matriz de testes.

**Gate 2:** F0 integrado; `ouroZoom` ainda intacto.

### Dia 3

- **Principal:** F2 (paredes claras, ambientes, anotações, legenda/quadro; remove `buildAreaPlanGeometry`).
- **S2:** F3 (flags/UI).
- **S4:** testes de área contra a branch F2 (pode rodar localmente com merge temporário ou cherry-pick).
- **S3:** começa a análise do DXF e a estrutura de camadas; a implementação final espera o F2.

### Dia 4

- **Principal:** termina F2; integra F0 e F3.
- **S3:** implementa F4 sobre o F2 (modelo nas camadas do DXF da planta + `AMBIENTES_*`).
- **S4:** F5 (view range, aberturas, prancha).

**Gate 3:** testes de área e planFrame verdes; `ouroZoom` intacto.

### Dia 5

- **Principal:** integra F4 e F5; resolve conflitos.
- **S3/S4:** ajustes dos testes e camadas DXF.
- **Todos:** roda `areaPlanDxf`, `dxfCad`, `areaPlanSheet`, `areaPlan*`, `planFrame*`.

### Dia 6

- **Principal:** suíte completa, `tsc`, `eslint`.
- Inspeção visual: planta de área x planta de piso (paredes, abertura, escada/rampa, telhado em projeção, view range, nível de baixo).
- Conferir DXF no verificador R12 e prancha.

### Dia 7 (buffer)

- Correções de última hora, documentação final, limpeza de worktrees e push da branch.
- Se tudo estiver verde no dia 6, o dia 7 é margem.

## Prompts de subagente (resumo)

**S1 — somente leitura**
> Implemente `TAREFA-planta-area-somente-leitura.md` na branch `fix/planta-area-somente-leitura`, a partir da A1. Não toque em `build.ts`/`types.ts`. Rode os testes de `selectTool`, `areaPlanOverlay`, `areaPlanAnotacao`. Entregue commits em pt-BR e o diff.

**S2 — flags/UI**
> Implemente a parte de modelo/UI da A2.3: `showStairs`, `showRoofs`, `showGeneric` em `AreaPlanGraphics`, defaults, `AreaPlanProperties` e `setPlanGraphicsAction`. Não edite `build.ts`; o perfil em `types.ts` só depois do F1. Testes em `areaPlan.test.ts`/UI.

**S3 — DXF**
> Implemente a A2.5 na branch `feat/planta-area-a2-dxf`, depois do F2. O DXF da área deve ter camadas de modelo + `AMBIENTES_*`, R12 válido, sem 370 e sem duplicar cotas/textos. Não altere `build.ts`. Testes: `areaPlanDxf`, `dxfCad`.

**S4 — caracterização/prancha**
> Prepare e rode a matriz de testes da área: view range, aberturas por classe, escada/rampa/telhado, piso/laje, nível de baixo, prancha. Não edite produção; se achar defeito, reporte com caso mínimo.

## Gates de qualidade (obrigatórios)

1. **Gate 0:** A1 na main e `ouroZoom.json` intacto.
2. **Gate 1:** A2.1 sem diff de ouro; planta de piso idêntica.
3. **Gate 2:** F0 integrado; `select` não move modelo na área; piso continua movendo.
4. **Gate 3:** F2 verde em `areaPlan*`, `planFrame*`, `areaPlanSheet*`.
5. **Gate 4:** DXF R12 válido com camadas de modelo + áreas.
6. **Gate 5:** suíte completa (7.850+ testes), `tsc`, `eslint` 0 erros, inspeção visual.

## Riscos de calendário

| Risco | Prob. | Impacto | Plano B |
|---|---|---|---|
| A2.1 altera saída do piso | Média | Alto | Reverter o passo, comparar `ouroZoom`, refazer bloco por bloco |
| Conflito em `types.ts` (F1 x F3) | Média | Médio | S2 começa pelo modelo/UI; `types.ts` só depois do F1 |
| DXF depende de geometria ainda instável | Média | Alto | S3 começa pelo mapa de camadas/testes; implementa depois do F2 |
| Testes de prancha quebram por contagem | Alta | Baixo | Ajustar expectativas para conteúdo (textos/camadas), não contagem bruta |
| Subagente trava em detalhe | Média | Médio | Principal assume a frente; subagente entrega diagnóstico + patch parcial |

## Resumo

- Caminho crítico: **F1 → F2 → F4 → F5**, ~6 dias.
- Paralelo: **F0** desde o dia 1; **F3** depois do F1; **F4/F5** depois do F2.
- Até 4 subagentes Flash, cada um em branch/worktree própria.
- O que garante a velocidade sem retrabalho: A2.1 sem mudar ouro, F0 isolada e DXF só depois da geometria estabilizada.
