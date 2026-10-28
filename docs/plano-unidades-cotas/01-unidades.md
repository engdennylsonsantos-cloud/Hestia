# Fase A: serviço de unidades do projeto

Objetivo: o usuário escolhe as unidades **no projeto** e **todo o programa** passa a mostrar e a aceitar valores nelas. O modelo continua em metros. Esta fase cria o serviço, a configuração e o suporte nos campos; a Fase C migra os usos soltos.

## Desenho (não mude sem motivo forte)

Grandezas (`Quantity`): `length` (comprimentos gerais: cotas, alturas, vãos, comprimentos de parede), `smallLength` (espessuras, folgas, tolerâncias, perfis, alizar), `area`, `volume`, `angle`, `slope`, `currency`.

Unidades por grandeza:
- `length` e `smallLength`: `'m' | 'cm' | 'mm' | 'ft' | 'in' | 'ft-in'` (`ft-in` = pés e polegadas fracionárias, ex.: `5' 6 1/2"`).
- `area`: `'m2' | 'cm2' | 'ft2'`. `volume`: `'m3' | 'l' | 'ft3'`. `angle`: `'deg' | 'rad'`. `slope`: `'percent' | 'deg'`.
- `currency`: apenas um símbolo (texto, ex.: `R$`), 2 casas.

Cada grandeza (exceto currency) tem `{ unit, decimals (0..5), suppressZeros?: boolean }`; `ft-in` usa também `denominator?: 2|4|8|16|32|64` (padrão 16). Global: `decimalSymbol: ',' | '.'` (padrão `,`), `currency: string` (padrão `R$`).

Padrões (devem reproduzir o que o programa mostra hoje no caso mais comum): `length m/2`, `smallLength cm/1`, `area m2/2`, `volume m3/3`, `angle deg/1`, `slope percent/1`, `decimalSymbol ','`, `currency 'R$'`, `suppressZeros false`.

Regras de uso:
- **Rótulo/valor somente leitura**: segue `decimals` da configuração.
- **Campo editável**: ao exibir, usa até 4 casas **e remove zeros à direita** (editar nunca perde precisão); ao digitar, `parseQuantity` aceita sufixo de unidade e vírgula ou ponto.
- Entrada sem sufixo = na unidade de exibição da grandeza naquele momento.
- Funções do `model`/`engine`/`geom` **não formatam texto de interface**. Elas devolvem números (metros). Onde já geram texto (cotas, quantitativos, rótulos), recebem `units: ResolvedUnits` como parâmetro explícito. Nada de estado global mutável.

## Passos

### U0: inventário (sem código de produção)
1. Rode e salve a saída resumida em `docs/plano-unidades-cotas/inventario-unidades.md` (por pacote: contagem e os 10 arquivos com mais ocorrências):
   - `Grep` de `toFixed\(`, `unit="(m|cm|mm)"`, `scale=\{100\}`, `m²`, `m³`, `Intl.NumberFormat`, `toLocaleString`, `replace\('\.', ','\)` em `packages/*/src` e `apps/web/src` (exclua `*.test.*`).
2. Commit: `docs(unidades): U0 inventário de usos de unidades`.

### U1: tipos, padrões e formatação (model)
Arquivos novos em `packages/model/src/`: `units.ts` (tipos, `defaultUnits`, `unitsOf`, conversões, `unitSymbol`) e `unitsFormat.ts` (formatação). Exporte tudo em `index.ts`.

API (assinaturas exatas):
```ts
export type Quantity = 'length' | 'smallLength' | 'area' | 'volume' | 'angle' | 'slope' | 'currency';
export interface QuantityFormat<U extends string> { unit: U; decimals: number; suppressZeros?: boolean; denominator?: 2 | 4 | 8 | 16 | 32 | 64 }
export interface UnitsSettings {
  length?: QuantityFormat<LengthUnit>; smallLength?: QuantityFormat<LengthUnit>;
  area?: QuantityFormat<AreaUnit>; volume?: QuantityFormat<VolumeUnit>;
  angle?: QuantityFormat<AngleUnit>; slope?: QuantityFormat<SlopeUnit>;
  decimalSymbol?: ',' | '.'; currency?: string;
}
export interface ResolvedUnits { /* o mesmo, tudo obrigatório */ }
export function defaultUnits(): ResolvedUnits;
export function resolveUnits(u: UnitsSettings | undefined): ResolvedUnits;   // mescla campo a campo com os padrões; decimals fora de 0..5 é limitado
export function unitsOf(p: Pick<Project, 'settings'> | undefined): ResolvedUnits; // memoizado por identidade de p.settings?.units (WeakMap); sem units → defaultUnits() (mesma referência)
export function unitSymbol(u: ResolvedUnits, q: Quantity): string;            // 'm', 'cm', 'mm', 'ft', 'in', "ft-in" → "'", 'm²', 'cm²', 'ft²', 'm³', 'L', 'ft³', '°', 'rad', '%', 'R$'
export function toDisplay(u: ResolvedUnits, q: Quantity, si: number): number;  // metros → unidade de exibição (área m²→cm² etc.)
export function fromDisplay(u: ResolvedUnits, q: Quantity, display: number): number;
export type QuantityUnit = LengthUnit | AreaUnit | VolumeUnit | AngleUnit | SlopeUnit;
export interface FormatOptions {
  withUnit?: boolean;   // padrão true
  decimals?: number;    // substitui o da configuração
  trim?: boolean;       // remove zeros à direita
  unit?: QuantityUnit;  // substitui a unidade da configuração (só vale se pertencer à grandeza; senão é ignorada). Usado por cotas com unidade própria
}
export function formatQuantity(u: ResolvedUnits, q: Quantity, si: number, o?: FormatOptions): string;
```
Regras de `formatQuantity`:
- Arredonda **após** converter; `-0` vira `0`; usa `decimalSymbol`; separador de milhar **não** é usado (mantém o estilo atual).
- `withUnit: true` → `"1,20 m"`, `"15,0 cm"`, `"12,50 m²"`, `"45,0°"`, `"2,5%"`, `"R$ 1250,00"`. Espaço entre número e unidade, exceto `°` e `%` (colados).
- `ft-in`: `5' 6 1/2"`; frações reduzidas (`8/16` → `1/2`); polegada inteira sem fração (`5' 6"`); menos de 1 pé (`0' 6"` mostra `6"`); sinal na frente.
- `slope` em `deg` usa o mesmo formato do ângulo; em `percent` é `tan(θ)*100`. O valor SI da inclinação no modelo: **confira no código** (`grep -rn "slope" packages/model/src/types.ts`) se é razão (rise/run) ou graus, e documente a conversão no cabeçalho do arquivo. Teste os dois sentidos.
- `currency`: `formatQuantity(u,'currency',v)` → símbolo + espaço + 2 casas.

Testes (`units.test.ts`, `unitsFormat.test.ts`): todos os pares unidade×grandeza; ida e volta `fromDisplay(toDisplay(x)) ≈ x`; arredondamento (0,005 → 0,01 com 2 casas; 0,995 cm); `suppressZeros`; negativo; zero; `-0`; `ft-in` (1,6764 m = `5' 6"`; 0,0127 m = `1/2"`); `unitsOf(undefined)` devolve sempre a **mesma** referência; `resolveUnits` com campos parciais.

Commit: `feat(unidades): U1 serviço de unidades e formatação`.

### U2: leitura de texto digitado (model)
Arquivo novo `packages/model/src/unitsParse.ts`:
```ts
export function parseQuantity(u: ResolvedUnits, q: Quantity, text: string): number | null; // devolve SI; null se inválido
```
Aceita (espaços livres, vírgula ou ponto decimal, sinal): `1,20` · `120cm` · `1.2 m` · `1200mm` · `3,5ft` · `10in` · `5'` · `5'6"` · `5' 6 1/2"` · `5-6` (ft-in só quando a unidade da grandeza é ft/in/ft-in) · área `12m2`/`12m²`/`1200cm2` · volume `2m3`/`500l` · ângulo `45`, `45°`, `45deg`, `0.78rad` · inclinação `5%`, `3deg`/`3°` · currency: número com ou sem símbolo.
Sem sufixo → unidade de exibição da grandeza. Sufixo de unidade incompatível com a grandeza (ex.: `m2` em `length`) → `null`. `NaN`, vazio, `1,2,3`, `abc` → `null`.
Testes: tabela com pelo menos 40 entradas (válidas e inválidas) e ida e volta com `formatQuantity` (para cada unidade, `parseQuantity(format(x))` ≈ x dentro da precisão exibida).
Commit: `feat(unidades): U2 leitura de valores com unidade`.

### U3: configuração no projeto (model)
1. `types.ts`: em `ProjectSettings` acrescente `units?: UnitsSettings` (JSDoc: "ausente = padrões de `defaultUnits()`"). **Sem** mudar `SCHEMA_VERSION`. `createEmptyProject` **não** grava `units` (ausente = padrão).
2. Confirme que o comando `{ type: 'setSettings', patch }` aceita `{ units: {...} }` e é desfazível (teste com `history`): aplicar, desfazer, refazer, e `JSON.stringify` → `JSON.parse` do projeto preserva `settings.units`.
3. Teste de compatibilidade: projeto antigo (sem `units`) abre e `unitsOf` devolve os padrões.
Commit: `feat(unidades): U3 units em ProjectSettings`.

### U4: entrada com expressões (tools)
Em `packages/tools/src/numeric.ts` (leia `parseNumber` antes) acrescente, **sem alterar o comportamento de `parseNumber`**:
```ts
export function parseQuantityText(text: string, u: ResolvedUnits, q: Quantity): number | null;
```
Ordem: (1) `parseQuantity(u,q,text)`; (2) se nulo e o texto parece expressão (`+ - * /` entre números, sem sufixo), `parseNumber(text)` e `fromDisplay(u,q,resultado)`; (3) senão `null`. Exporte em `index.ts`. Testes: `"1,2+0,3"` em m → 1,5; em cm → 0,015; `"120cm"` → 1,2; `"2*60cm"` → `null` (sufixo em expressão não é suportado; documente no JSDoc).
Commit: `feat(unidades): U4 parseQuantityText`.

### U5: hook e helpers na web
1. Arquivo novo `apps/web/src/ui/useUnits.ts` (leia `useProject` em `apps/web/src/editor/controller.ts` antes):
   - `useUnits(): ResolvedUnits` — assina o projeto e devolve `unitsOf(project)` (referência estável quando `settings.units` não muda; o componente só re-renderiza se a referência mudar).
   - `currentUnits(): ResolvedUnits` — `unitsOf(editor.project)` para código fora do React (handlers).
   - `useFormat(): (q: Quantity, si: number, o?: FormatOptions) => string` — função estável (`useCallback` sobre `units`).
2. Teste (vitest + o ambiente de teste React que já existe no app; se não houver teste de hook no repo, teste as funções puras e deixe o hook com teste de render simples): mudar `settings.units` troca o texto produzido.
Commit: `feat(unidades): U5 hook useUnits`.

### U6: `NumField` por grandeza (web)
Leia `apps/web/src/ui/fields.tsx` inteiro e liste **todos** os componentes de campo numérico (NumField, sliders, steppers, campos de cota etc.).
1. Em `NumField` acrescente a prop `quantity?: Quantity`. Quando presente: valor exibido = `formatQuantity(units, quantity, valorSI, { withUnit: false, trim: true, decimals: 4 })`; rótulo de unidade = `unitSymbol`; ao confirmar, `parseQuantityText`; `step`/`min`/`max` continuam em **SI** (metros) e são convertidos internamente; incremento por setas/rodinha respeita a unidade (1 passo = 1 unidade do último dígito exibido, no máximo).
2. As props antigas `unit`, `scale`, `decimals` continuam funcionando **por enquanto** e ganham `/** @deprecated use quantity */`. Quem passa `quantity` ignora as antigas. (A Fase C remove-as no último passo.)
3. Testes de componente/puros: `quantity="length"` com unidade `cm` mostra `120` para 1,2 m e grava 1,2 ao digitar `120`; `120cm` e `1,2m` gravam 1,2; texto inválido não grava e mantém o valor anterior; `smallLength` padrão mostra cm.
Commit: `feat(unidades): U6 NumField por grandeza`.

### U7: exportações
Confirme (leitura + teste) que DXF (`$INSUNITS`) e IFC (`METRE`) **não** mudam com a configuração do projeto: o arquivo exportado é sempre em metros. Escreva um teste em `packages/io` que exporta o mesmo projeto com `units` em `ft-in` e em `m` e compara que o conteúdo é idêntico. Se algum exportador usar texto de interface (ex.: cotas como texto DXF), ele **deve** usar `ResolvedUnits` do projeto (anote para a Fase C).
Commit: `test(unidades): U7 exportações independentes da unidade de exibição`.

### Verificação da fase A
`npm run check` verde. Atualize `PROGRESSO.md`. Push.
