# Handoff — como continuar o Hestia (2026-10-22)

Branch de trabalho: `claude/wizardly-goldberg-qtjveg` (tudo integrado, testes verdes). `main` NÃO foi atualizada (aguarda confirmação do dono).

## Estado
- Integrado na branch: todas as fases A–J, T1 (hachura GPU + regressão visual GPU), T4 (junção entre níveis, `cut` por volume), T5/P10 (término por camada contra paredes, piso/laje único; decisão `docs/decisoes/0025-termino-por-camada-piso-unico.md`).
- Última verificação completa: vitest 277 arquivos / 3436 testes, tsc, eslint, check-boundaries/parity/props-density, build, regressão visual CPU (32 casos) e GPU, e2e piso-unico/pisos/lajes/contorno, test:perf.
- Pendências, em ordem:
  1. **P7c — recortar a parede nos desenhos (planta, corte, elevação, 3D) pelas camadas de piso/laje que vencem.** Trabalho INCOMPLETO e interrompido na branch `oc/t6` (commit wip; `tsc` limpo, testes não rodados/completos). Brief completo em `docs/handoff/t6-brief.md`. Ao concluir, marcar [x] em `docs/paridade/paredes.md` E3, `pisos.md` C6, `lajes.md` C8.
  2. Rodada final: `npm run test:completo`, regressão visual CPU + GPU, e2e, `test:perf`; atualizar `docs/07-STATUS-V1.md`.
  3. Atualizar `main` (só com confirmação do dono) e republicar o artefato (`npm run build:artifact`, capacidade `{"downloads": true}`, artefato `91MRKU1jfavYDDBGUjbgPo`, próxima versão 15).
- Branch `oc/t2` (commit `fe930ff`): comando "Vincular às paredes" — NÃO integrar a interface (o dono pediu outra coisa: T5). Só o motor `packages/engine/src/outlineSuggest.ts` pode ser aproveitado.
- Adiado por decisão do dono: guarda-corpo/corrimão, pilares e vigas simples, escada multi-andar, "Inverter corte" (P-4). DXF/IFC no artefato seguem com cópia para a área de transferência.

## Regras do dono (valem sempre)
- Responder em português. Quando pedir "só comentar", não alterar nada.
- Piso/laje: decidir ordem de corte SÓ por atributos da camada (prioridade efetiva), nunca por nome/material. O dono quer um piso único envolvendo a obra com limite de cada camada contra a parede (face, núcleo, passa, até prioridade N, cm) — já feito no T5.
- Economizar tokens: trabalho volumoso em subagentes Haiku, um por tarefa, em worktrees; verificar o resultado antes de integrar.

## Prompt para colar numa nova sessão local
```
Repositório Hestia. Faça `git fetch` e `git checkout claude/wizardly-goldberg-qtjveg`. Leia docs/HANDOFF.md, docs/07-STATUS-V1.md e docs/decisoes/0023-juncao-piso-laje-parede.md e 0025-termino-por-camada-piso-unico.md. Depois: (1) retome a tarefa P7c a partir da branch oc/t6 (`git merge origin/oc/t6` ou cherry-pick do wip; brief em docs/handoff/t6-brief.md, regras em docs/handoff/regras-gerais.md): a parede deve ser recortada na planta, no corte, na elevação e no 3D pelas partes por camada já calculadas em packages/engine/src/junctionLevel.ts, de modo que o desenhado = o quantificado; paredes sem sobreposição ficam idênticas (regressão visual 0,000%); (2) rode tsc, eslint, vitest, scripts/check-*.mjs, build, tests/e2e/visual-regression.mjs e visual-regression-gpu.mjs, test:perf e os e2e; (3) atualize docs/paridade (E3, C6, C8) e 07-STATUS-V1; (4) NÃO atualize main nem republique o artefato sem eu confirmar. Responda sempre em português.
```
