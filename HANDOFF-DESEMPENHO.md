# Handoff: integração final do desempenho (Hestia)

Documento para continuar o trabalho em outra ferramenta. Não commitar este arquivo.

## Onde estamos

- Branch alvo: `feat/revit-ui-theme`, HEAD `75d11de` (interface Revit + anotações + polimentos de QA). O checkout principal (`<raiz-do-repositorio>`) está limpo e NÃO deve ser alterado pelo merge.
- Trabalho de desempenho: branch `integracao/perf-etapas`, HEAD `bb72f2a` (sobre `9d9d2e8`). Já está no GitHub (`origin/integracao/perf-etapas`). Não está na `feat` ainda.
- Worktree do merge: `.claude/worktrees/integracao-final`, branch `integracao/final`, criado a partir de `75d11de`.
- **Estado do worktree: MERGE EM ANDAMENTO** (`git merge integracao/perf-etapas`), com conflitos em `packages/render/src/plan/`: `build.ts`, `notes.ts`, `notes.test.ts`, `planFrame.ts`, `tags.ts`, `types.ts` (e possivelmente outros; confira com `git diff --name-only --diff-filter=U`).

## O que cada lado traz

- HEAD (75d11de): anotações novas (cotas com formatação, etiquetas, linha de detalhe, região preenchida), interface Revit.
- integracao/perf-etapas: zoom da planta sem recriar geometria (`zoomOps.ts`, `limiares.ts`, `marcadores.ts`; `noteOps`, `wallTagLabels`, `roomOps`, `sectionMarkOps` e `previewOverlay` perderam o parâmetro de zoom/viewport; `StrokeOp`/`FillOp` ganharam `deslocamentoPx`/`faixa`; `LabelOp` ganhou `papel`; `PlanOps.limiares`; `planFrame.ts` sem zoom nas chaves), espessura de papel no shader, 3D com caixas instanciadas, edição na tela, abertura com cache.

## Regra da resolução

- Manter as DUAS mudanças. Quando a mesma função foi alterada dos dois lados, usar a assinatura nova do desempenho com a lógica nova das anotações.
- Não inventar comportamento. Não remover testes para passar. Atualizar expectativa só se a mudança de API for a causa, e documentar no relatório.
- `ouroZoom.test.ts` e `zoomSemRecriar.test.ts` são a prova de imagem igual e de não recriação. Se falharem, é bug a corrigir.

## Como verificar (sem node_modules no worktree)

1. Config de paths FORA do repositório (pasta scratchpad): `paths` de `@hestia/*` apontando para `packages/*/src/index.ts` deste worktree; rodar `tsc` com ela. Os 4 erros antigos de `scripts/perf-baselines/projeto-sintetico.mts` são aceitáveis.
2. Testes com config de alias fora do repositório: primeiro `packages/render/src/plan`, depois `packages/render`, `packages/engine`, `packages/tools`, `packages/model`.
3. Build do app: criar um `vite.integ.config.ts` TEMPORÁRIO dentro de `apps/web` com alias de `@hestia/*` para o worktree; rodar `npx vite build --config vite.integ.config.ts`; depois APAGAR esse arquivo.
4. Medição no navegador: `node tests/e2e/perf-browser.mjs --save` com `PERF_ROTULO=final` (no worktree; usa o `apps/web/dist` dele). Comparar com `scripts/perf-baselines/browser-20-pav-2026-10-26-integrado.json`.

## Depois que o merge estiver verde

- Commitar o merge (sem incluir `HANDOFF-DESEMPENHO.md`, nem `.claude/`, nem `packages/model/src/.edit_room_sep.cjs`, nem `scripts/perf-baselines/browser-20-pav-2026-10-25-etapa0.json` se estiver untracked).
- NÃO avançar a `feat/revit-ui-theme` nem dar push sem confirmação do usuário. Quando confirmado: `git merge --ff-only integracao/final` no checkout principal (ou via worktree), e depois `git push`.
- Checagem visual no navegador: anotações (cota individual e em cadeia, etiquetas, "Etiquetar todos", linha e região de detalhe) e a planta com zoom em 12, 60 e 220. Pedir ao usuário para conferir o que não dá para verificar sozinho.

## O que ainda falta depois do merge (não fazer sem decisão)

- Abertura de 20 pavimentos: 311 ms (meta 300 ms).
- Pisos, lajes, telhados e escadas continuam como geometria (a 3D só tem caixas para paredes retas e portas/janelas).
- Etapa 5: cortes e elevações por plano de recorte na GPU.
- Etapas 7 e 8 (WebGPU e WASM): só se a medição justificar.

## Regras de convivência

- Não use `git stash` (compartilhado com outras sessões).
- Não faça `git reset --hard` em worktrees com trabalho não commitado.
- Não mexa nas branches `wip/anotacoes`, `merge/interface-revit` nem `feat/interface-revit`: já estão dentro da `feat`.
- Não envie nada ao GitHub sem confirmação do usuário.

## Subagente em andamento

Havia um subagente resolvendo esses conflitos (id `a4e771890065799c4`) no worktree `integracao-final`. Se ele ainda estiver rodando, o estado do worktree é o dele. Se não, retome daqui.
