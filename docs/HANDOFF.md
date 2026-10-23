# Handoff — como continuar o Hestia (2026-10-22)

Branch de trabalho: `claude/wizardly-goldberg-qtjveg` (tudo integrado, testes verdes). `main` NÃO foi atualizada (aguarda confirmação do dono).

## Estado
- Integrado na branch: todas as fases A–J, T1 (hachura GPU + regressão visual GPU), T4 (junção entre níveis, `cut` por volume), T5/P10 (término por camada contra paredes, piso/laje único; decisão `docs/decisoes/0025-termino-por-camada-piso-unico.md`) e **P7c parte 2** (parede recortada na planta, corte, elevação e 3D pelas camadas de piso/laje; decisão 0023, seção "Status da P7c, parte 2").
- Última verificação completa (2026-10-22, Windows): vitest 278 arquivos / 3675 testes (`test:completo`, 60 sementes; `test:rapido` 277/3373), tsc, eslint, check-boundaries/parity/props-density (paridade 100% nos nove), regressão visual GPU 6/6 (0,000–0,074%) e CPU (os 2 casos novos em 0,000%; os antigos divergem 0,37–0,75% só em texto e hachura por causa do ambiente — o A/B antes/depois no mesmo ambiente deu 0,000%), e2e parede-recorte/piso-unico/pisos/lajes/contorno/sections/flow, `test:perf`. Build: no Windows a minificação do esbuild falha com acesso negado ao remover o temporário; os e2e usam `npm run build -w @hestia/web -- --target esnext --minify false`.
- Pendências, em ordem:
  1. Atualizar `main` (só com confirmação do dono) e republicar o artefato (`npm run build:artifact`, capacidade `{"downloads": true}`, artefato `91MRKU1jfavYDDBGUjbgPo`, próxima versão 15).
  2. Não bloqueantes: restante do P8 (perímetro externo, cor e hachura por camada, IFC e DXF por camada), P-5 (forro criado a partir de ambiente), P13/X4/X5 de aberturas, P-4 (inversão por par) e o canto reentrante do L. No recorte da parede ficam de fora camada com topo/base inclinados, parede curva e laje com caimento fora da junção.
  3. Conferência visual final em navegador real: os testes cobrem geometria, unidade e desenho, não a aparência em todas as combinações de zoom, tema e GPU.
- Branch `oc/t2` (commit `fe930ff`): comando "Vincular às paredes" — NÃO integrar a interface (o dono pediu outra coisa: T5). Só o motor `packages/engine/src/outlineSuggest.ts` pode ser aproveitado.
- Adiado por decisão do dono: guarda-corpo/corrimão, pilares e vigas simples, escada multi-andar, "Inverter corte" (P-4). DXF/IFC no artefato seguem com cópia para a área de transferência.

## Regras do dono (valem sempre)
- Responder em português. Quando pedir "só comentar", não alterar nada.
- Piso/laje: decidir ordem de corte SÓ por atributos da camada (prioridade efetiva), nunca por nome/material. O dono quer um piso único envolvendo a obra com limite de cada camada contra a parede (face, núcleo, passa, até prioridade N, cm) — já feito no T5.
- Economizar tokens: trabalho volumoso em subagentes Haiku, um por tarefa, em worktrees; verificar o resultado antes de integrar.

## Prompt para colar numa nova sessão local
```
Repositório Hestia. Faça `git fetch` e `git checkout claude/wizardly-goldberg-qtjveg`. Leia docs/HANDOFF.md, docs/07-STATUS-V1.md e docs/decisoes/0023-juncao-piso-laje-parede.md. A P7c parte 2 está feita (E3 de paredes, C6 de pisos e C8 de lajes em [x]): a parede é recortada na planta, no corte, na elevação e no 3D pelas partes por camada de `junctionLevel`. Confira o estado com `npm run check`, `npm run test:completo`, `node tests/e2e/visual-regression.mjs`, `node tests/e2e/visual-regression-gpu.mjs` e `npm run test:perf`; no Windows o build local só passa com `npm run build -w @hestia/web -- --target esnext --minify false` (a minificação do esbuild falha por acesso negado). Próximos itens: as pendências não bloqueantes do HANDOFF. NÃO atualize `main` nem republique o artefato sem eu confirmar. Responda sempre em português.
```
