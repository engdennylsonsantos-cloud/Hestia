# Tarefa (T7 · Fase 0, parte A) — núcleo derivado também para piso e laje

Repositório: `<raiz-do-repositorio>` (monorepo TypeScript, npm workspaces, vitest).
Código, comentários e mensagens em **português**. Nada de `console.log`, nada de arquivos de depuração,
nada de `any`, `as` ou non-null assertion (`!`) em código novo. Arquivos com no máximo 420 linhas.

## Objetivo

Hoje o núcleo derivado (`coreRange`, `layerSpans`, `coreSpan`, `totalThickness`) só aceita `WallType`, em
`packages/model/src/wallType.ts`. `FloorType` e `SlabType` também têm `layers: Layer[]`; o editor de tipo de piso e de
laje vai precisar das mesmas funções (fase 0 do T7, decisão D1/D6) sem importar o motor.

Leia antes: `packages/model/src/wallType.ts`, `packages/model/src/types.ts` (interface `Layer`, `LayerFunction`,
`WallType`, `FloorType`, `SlabType`) e `packages/model/src/model.test.ts` (estilo dos testes).

## Mudanças exigidas

### 1. `packages/model/src/wallType.ts`

As quatro funções passam a aceitar qualquer objeto com camadas, por tipo estrutural — **sem** mudar nome, retorno nem
comportamento:

- `totalThickness(t: { layers: readonly Layer[] })`
- `coreRange(t: { layers: readonly Layer[] })`
- `layerSpans(t: { layers: readonly Layer[] })`
- `coreSpan(t: { layers: readonly Layer[] })`

Mantenha os comentários existentes (inclusive a referência à decisão 0002) e acrescente, no comentário de `coreRange`,
que a mesma convenção vale para parede, piso e laje (na parede, a ordem é da face externa para a interna; no piso e na
laje, de cima para baixo). Não mude a lógica: do primeiro ao último `function === 'structure'`, inclusive; sem
estrutura, o elemento inteiro é núcleo.

### 2. `packages/model/src/wallType.test.ts` (novo)

Testes vitest com valores calculados à mão. Use `import { describe, expect, it } from 'vitest'` e importe de
`'./wallType.ts'` (os testes do pacote usam a extensão `.ts`). Monte as camadas com um auxiliar local, por exemplo:

```ts
const camada = (func: LayerFunction, thickness: number): Layer => ({ function: func, materialId: 'mat_x', thickness, wraps: false });
```

Funções de camada existentes: `structure`, `substrate`, `thermal`, `membrane`, `finish1`, `finish2`.

Casos (valores conferidos à mão):

1. **Núcleo no meio** — camadas `[finish1 0,01 | substrate 0,02 | structure 0,19 | substrate 0,02 | finish2 0,002]`:
   - `totalThickness` = 0,242
   - `coreRange` = `{ first: 2, last: 2 }`
   - `coreSpan` = `{ from: 0,03, to: 0,22 }`
   - `layerSpans()[2]` = `{ from: 0,03, to: 0,22 }`
2. **Duas camadas de estrutura com acabamento no meio** — `[structure 0,12 | substrate 0,02 | structure 0,05]`:
   - `coreRange` = `{ first: 0, last: 2 }`
   - `coreSpan` = `{ from: 0, to: 0,19 }`
3. **Sem estrutura** (piso de acabamento) — `[finish1 0,01 | substrate 0,03]`:
   - `coreRange` = `{ first: 0, last: 1 }`
   - `coreSpan` = `{ from: 0, to: 0,04 }`
4. **Lista vazia** — `coreRange` = `{ first: 0, last: 0 }`, `layerSpans` = `[]`, `coreSpan` = `{ from: 0, to: 0 }`,
   `totalThickness` = 0.
5. **Núcleo que começa na primeira camada** — `[structure 0,1 | substrate 0,02]`: `coreRange` = `{ first: 0, last: 0 }`,
   `coreSpan` = `{ from: 0, to: 0,1 }`.

Use `toBeCloseTo(esperado, 12)` para números em metros e `toEqual` para `{ first, last }` e para as listas.
Títulos de `describe`/`it` em português, descrevendo o comportamento ("núcleo no meio das camadas", etc.).

## Proibições

- Mexer **somente** em `packages/model/src/wallType.ts` e `packages/model/src/wallType.test.ts`.
- Não editar `package.json`, `docs/`, `SCHEMA_VERSION`, nem outros pacotes.
- Não rodar `npm install`, `git checkout`, `git reset`, `git push` e não criar commit.

## Verificação antes de responder

Na raiz do repositório:

```
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/model
```

Os dois têm de passar. Se algo falhar por causa da sua mudança, corrija e rode de novo.

## Resposta final

Responda em português, curto: (a) o que mudou em cada arquivo, (b) saída resumida de `tsc` e do `vitest run
packages/model` (números de arquivos/testes), (c) qualquer desvio do que foi pedido.
