# Tarefa (T7 · Fase 0, parte B) — núcleo visível nos editores de piso e de laje

Repositório: `<raiz-do-repositorio>` (monorepo TypeScript, vitest, React sem framework de
render nos testes). Código, comentários e textos de UI em **português**. Nada de `console.log`. Arquivos ≤ 420 linhas.
Sem dependências novas. Imports internos com extensão `.ts`/`.tsx`, como nos arquivos vizinhos.

## Contexto

O editor de tipo de **parede** (`apps/web/src/ui/dialogs/WallTypeDialog.tsx`) já mostra o núcleo: linha da camada com
`className="core"`, badge `P{n}` de prioridade e a seção ao vivo com a faixa do núcleo (`SectionPreview.tsx`). Os
editores de **piso** (`FloorTypeDialog.tsx`) e **laje** (`SlabTypeDialog.tsx`) não mostram nada disso. Esta parte liga
isso, sem mudar geometria, quantitativos nem desenho do modelo (decisão D6 do T7).

Leia antes, para copiar o estilo: `WallTypeDialog.tsx` (linhas 116–160), `SectionPreview.tsx` (linhas 57–62),
`FloorTypeDialog.tsx`, `SlabTypeDialog.tsx`, `FloorSectionPreview.tsx`, `SlabSectionPreview.tsx`.
A classe CSS `.core` já existe (`apps/web/src/styles.css`, `.layers tr.core td`), assim como `.fn-cell` e `.pbadge`.
As funções `coreRange`, `coreSpan`, `layerPriority` vêm de `@hestia/model` e já aceitam `{ layers: readonly Layer[] }`.

## 1. Novo módulo `apps/web/src/ui/dialogs/coreHint.ts`

Função pura, testável sem React (o projeto testa funções de formulário, não render):

```ts
export interface CoreHint {
  /** Nota para embaixo da tabela de camadas. */
  text: string;
  /** true quando o tipo não tem camada Estrutura (o núcleo é o elemento inteiro). */
  semEstrutura: boolean;
}

export function coreHint(type: { layers: readonly Layer[] }, face = 'face de cima'): CoreHint
```

Regras do `text` (uma decimal, vírgula, em cm a partir da face indicada):

- tipo sem camada `structure` **e** com camadas: `Sem camada Estrutura: o núcleo é o elemento inteiro.` e
  `semEstrutura: true`.
- tipo sem camada nenhuma: `Sem camadas: não há núcleo.` e `semEstrutura: true`.
- tipo com `structure`: `Núcleo: camadas {first+1} a {last+1}, de {from} a {to} cm da {face}.`, com `{from}`/`{to}` =
  `coreSpan(type)` em cm (`toFixed(1)` e `.` → `,`), `{first}`/`{last}` = `coreRange(type)` (índices 0-based, exibidos
  em 1-based), e `semEstrutura: false`.

Use `coreRange` e `coreSpan` de `@hestia/model`; não reimplemente a regra. Nada de `any`, `as` ou `!` neste arquivo.

## 2. Novo `apps/web/src/ui/dialogs/coreHint.test.ts`

Vitest (`import { describe, expect, it } from 'vitest'`, importando de `'./coreHint.ts'`), com um auxiliar local:

```ts
const camada = (func: LayerFunction, thickness: number): Layer => ({ function: func, materialId: 'mat_x', thickness, wraps: false });
```

Casos (textos conferidos à mão):

1. `[substrate 0,02 | structure 0,15]` → `Núcleo: camadas 2 a 2, de 2,0 a 17,0 cm da face de cima.`, `semEstrutura: false`.
2. `[finish1 0,03 | membrane 0 | structure 0,10]` → `Núcleo: camadas 3 a 3, de 3,0 a 13,0 cm da face de cima.`
3. `[finish1 0,01 | substrate 0,03]` → `Sem camada Estrutura: o núcleo é o elemento inteiro.`, `semEstrutura: true`.
4. `[finish1 0,01 | substrate 0,02 | structure 0,19]` com `coreHint(t, 'face externa')` →
   `Núcleo: camadas 3 a 3, de 3,0 a 22,0 cm da face externa.`
5. `[]` → `Sem camadas: não há núcleo.`, `semEstrutura: true`.

Títulos em português, descrevendo o comportamento.

## 3. `FloorTypeDialog.tsx` e `SlabTypeDialog.tsx` (mudanças iguais nos dois)

- Importar `coreRange` e `layerPriority` de `@hestia/model` (sem tirar os imports existentes) e `coreHint` de
  `'./coreHint.ts'`.
- No corpo do componente: `const core = coreRange(draft);` e `const nucleo = coreHint(draft.layers);`.
- Na `draft.layers.map((l, i) => ...)`: `const inCore = i >= core.first && i <= core.last;` e a linha de camada passa a
  ser `<tr className={inCore ? 'core' : ''}>` (hoje é `<tr>`).
- Na célula da função, envolver o `<select>` no padrão do editor de parede, com o badge de prioridade:

```tsx
<td>
  <span className="fn-cell">
    <select ... >...</select>
    <span className="pbadge" title="Prioridade de junção efetiva">P{layerPriority(l)}</span>
  </span>
</td>
```

- Logo depois do `<div className="total">…</div>` (espessura total), acrescentar a nota:
  `<p className="hint">{nucleo.text}</p>`.
- Não mexer em mais nada (nem nos campos de custo/código, nem no `error`, nem no `temPrioridadeEmpatada`).

## 4. `FloorSectionPreview.tsx` e `SlabSectionPreview.tsx` (mudanças iguais nos dois)

Marcar a faixa do núcleo na seção ao vivo, no mesmo espírito de `SectionPreview.tsx` (cor `var(--accent)`):

- Importar `coreRange` de `@hestia/model`.
- Calcular `const core = coreRange(type);` e, dentro do `bands.map`, desenhar por cima do preenchimento da camada do
  núcleo uma borda de destaque:
  `{inCore && <rect x={x} y={b.y} width={w} height={b.h} fill="none" stroke="var(--accent)" strokeWidth={1.4} />}`
  (`inCore` calculado por índice como nos diálogos).
- Depois do `bands.map`, desenhar o colchete do núcleo na margem esquerda (x = 8 a 14, as camadas começam em x = 22) com
  o rótulo `núcleo` girado −90°, sem `!`:
  `const primeira = bands[core.first]; const ultima = bands[core.last];` e só desenhar se as duas existirem, usando
  `primeira.y` e `ultima.y + ultima.h` para o topo e a base do colchete.
- Não mudar tamanho, `viewBox`, cores das camadas, hachura nem a cota total.

## Proibições

- Mexer **somente** nos seis arquivos acima.
- Não editar `package.json`, `docs/`, `packages/`, nem outros arquivos de `apps/web`.
- Não rodar `npm install`, `git checkout`, `git reset`, `git push`, e não criar commit.

## Verificação antes de responder

Na raiz do repositório, os três têm de passar:

```
npx tsc -p tsconfig.json --noEmit
npx eslint apps/web
npx vitest run apps/web
```

## Resposta final

Em português, curto: (a) o que mudou em cada arquivo, (b) saída resumida de `tsc`, `eslint apps/web` e
`vitest run apps/web`, (c) qualquer desvio do que foi pedido.
