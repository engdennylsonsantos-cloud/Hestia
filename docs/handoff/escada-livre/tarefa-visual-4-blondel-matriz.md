# Tarefa visual 4: cartão "Fórmula de Blondel" e campos por estilo no modal da escada (independente das tarefas 1 a 3)

Modelo executor: DeepSeek flash. Referência (seções 7 e 8): `C:\Users\DENNYL~1\AppData\Local\Temp\claude\c--Users-Dennylson-Desktop-programas-Hestia\ec971bba-fda3-400c-8c8b-b900e6031c79\scratchpad\especificacao-visual.md`.

## Contexto
Worktree `C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2`, app em `apps/web/src`. O modal do TIPO de escada (`ui/dialogs/StairTypeDialog.tsx`) tem a calculadora (`StairCalculatorPanel.tsx`), as seções (`StairTypeSections.tsx`) e funções de cálculo em `stairTypeCalc.ts` (`computeStairCalc(type, floorToFloorMeters)` devolve `{valid, risers, riser, tread, sum, status:'ok'|'warn'|'bad', delta, run, angleDeg}`; `STAIR_DIALOG_PRESETS`, `matchPreset`). Dois problemas: (1) a fórmula de Blondel não é explicada; (2) todos os estilos (`runStyle: 'monolithic' | 'assembled' | 'post'`) mostram os mesmos campos. Você cria (a) um cartão que explica a fórmula e faz a conta ao vivo; (b) a matriz de visibilidade de campos por estilo e a aplica nas seções; (c) as chaves i18n pt/en.
Fatos do motor (não mude): N = `riserCountFor(H, maxRiser)` = `max(1, ceil(H/maxRiser − 1e-9))`; R = H ÷ N; T = `clamp((alvo − a·R)/b, minTread, maxTread)`; a faixa [calcMin, calcMax] só gera aviso. Valores padrão do tipo: a=2, b=1, alvo 0,63 m, min 0,63, max 0,65, maxRiser 0,18, minTread 0,28, maxTread 0,32.

## Arquivos que você PODE criar
- `apps/web/src/ui/dialogs/stairBlondel.ts` e `stairBlondel.test.ts`
- `apps/web/src/ui/dialogs/StairBlondelCard.tsx` e `StairBlondelCard.test.ts` (use `renderToStaticMarkup`; se precisar, `// @vitest-environment node` no topo)
- `apps/web/src/ui/dialogs/stairFieldVisibility.ts` e `stairFieldVisibility.test.ts`
## Arquivos que você PODE editar (somente como descrito)
- `apps/web/src/editor/i18n.ts`: ACRESCENTAR chaves no fim do bloco `pt` e no fim do bloco `en` (mesmas chaves nos dois, tipagem de `Dict` depende disso). Não renomear nem apagar chaves existentes.
- `apps/web/src/ui/dialogs/StairTypeSections.tsx`: aplicar a visibilidade (item 3) e rótulos por estilo.
- `apps/web/src/ui/dialogs/StairCalculatorPanel.tsx`: só o ramo do estilo poste (item 4).
- `apps/web/src/ui/dialogs/StairTypeDialog.tsx`: só o JSX dentro de `<div className="stt-side">` (item 5). NÃO mexer em `changeStyle` nem em `preserveOnStyleChange`.
## NÃO tocar
`styles.css`, `stairTypeCalc.ts`, `stairTypeForm.ts`, `StairSectionPreview.tsx`, `RampSectionPreview.tsx`, `ui/schematic/*`, `packages/*`.

## 1. `stairBlondel.ts` (puro)
```ts
import type { StairType } from '@hestia/model';
export interface BlondelInput extends Pick<StairType, 'maxRiser'|'minTread'|'maxTread'|'calcRiserFactor'|'calcTreadFactor'|'calcTarget'|'calcMin'|'calcMax'> {}
export interface BlondelLive {
  valid: boolean;
  height: number;            // m
  quotient: number;          // H ÷ maxRiser (sem arredondar)
  risers: number;            // N
  riser: number;             // R exato (m)
  riserShown: number;        // R arredondado a 0,1 cm (m)
  treadRaw: number;          // (alvo − a·riserShown) ÷ b (m), antes de limitar
  tread: number;             // limitado a [minTread, maxTread] (m)
  clamp: 'min' | 'max' | null;
  sum: number;               // a·riserShown + b·tread (m), o que a tela mostra
  status: 'ok' | 'warn' | 'bad';   // do computeStairCalc EXATO
  side: 'below' | 'above' | 'in'; // soma exata abaixo/acima/dentro da faixa
  delta: number;             // distância exata à faixa (m)
}
export const round01cm = (m: number): number => Math.round(m * 1000) / 1000;
export function blondelLive(type: BlondelInput, floorToFloor: number): BlondelLive;
export function formulaText(a: number, b: number, lang: 'pt' | 'en'): string;   // "2·R + T"; a=2.5,b=1.5 -> "2,5·R + 1,5·T" (pt) / "2.5·R + 1.5·T" (en)
```
Regras: `valid=false` (demais campos 0, `status:'bad'`) se `computeStairCalc(type, H).valid` é falso. Senão use `computeStairCalc` para `risers`, `riser`, `status`, `delta`; `quotient = H/maxRiser`; `riserShown = round01cm(riser)`; `treadRaw = (calcTarget − a·riserShown)/b`; `tread = min(maxTread, max(minTread, treadRaw))`; `clamp = treadRaw < minTread - 1e-9 ? 'min' : treadRaw > maxTread + 1e-9 ? 'max' : null` (a tolerância evita que 0,63 − 0,35 = 0,27999999999999997 vire 'min'); `sum = a·riserShown + b·tread`; `side` pela soma EXATA (`a·riser + b·tread exato`) contra `[calcMin, calcMax]` (tolerância 0,0005). `formulaText`: fator 1 some (`R`/`T`); inteiros sem casas; senão até 2 casas sem zeros à direita.
Testes (valores exatos): tipo padrão (a=2,b=1,alvo .63,min .63,max .65,maxRiser .18,minTread .28,maxTread .32), `H=3.0`: `risers=17`, `quotient≈16.6667`, `riserShown=0.176`, `treadRaw≈0.278` (4 casas), `tread=0.28`, `clamp='min'`, `sum≈0.632`, `status='ok'`, `side='in'`. `H=3.5`: `risers=20`, `riser=0.175`, `treadRaw=0.28` (0.63−0.35), `clamp=null` (igual ao mínimo, não menor), `sum=0.63`. `H=0` → `valid=false`. Tipo com `calcMax: 0.63, calcMin: 0.60, calcTarget: 0.62`, `H=3.0`: `treadRaw≈0.268` → `tread=0.28`, soma exata `2*0.17647+0.28=0.63294` → `side='above'`, `delta≈0.00294`, `status='warn'` (distância ≤ 3 cm e fora da faixa com tolerância 0,0005). `formulaText(2,1,'pt')==='2·R + T'`, `formulaText(1,1,'pt')==='R + T'`, `formulaText(2.5,1.5,'pt')==='2,5·R + 1,5·T'`, em en `'2.5·R + 1.5·T'`.

## 2. `StairBlondelCard.tsx`
`export function StairBlondelCard(props: { type: StairType; heightCm: number }): ReactElement`. Usa `useI18n((s)=>s.lang)`, `I18N[lang]`, `fmtNum`, `blondelLive(type, heightCm/100)`. Estrutura (`<section className="dsec" aria-labelledby="stt-bl-title" style={{margin:0}}>`):
1. `<div id="stt-bl-title" className="stt-ref" style={{fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em'}}>{t.stt_bl_title}</div>`
2. `<p className="hint">{t.stt_bl_intro}</p>`
3. Fórmula em destaque (fonte mono, `var(--font-mono)`, 15px): `{formulaText(a,b,lang)} = {fmtNum(alvo*100,1,lang)} cm`, ex. `2·R + T = 63,0 cm`. Abaixo: `fill(t.stt_bl_range,{min,max})` e `t.stt_bl_legend` (`stt-ref`).
4. Se `!live.valid`: `<p className="stt-ref">{t.stt_bl_invalid}</p>` e pare.
5. Título `fill(t.stt_bl_live_title,{h: fmtNum(heightCm,0,lang)})` e lista `<ol>` com 4 itens (números em cm com 1 casa via `fmtNum(m*100,1,lang)`; H em cm 0 casas):
   - passo 1 `stt_bl_step_n`: `{h}`, `{maxRiser}`, `{q}` (quociente 1 casa), `{N}`.
   - passo 2 `stt_bl_step_r`: `{h}`, `{N}`, `{R}` (= riserShown).
   - passo 3 `stt_bl_step_t`: `{target}`, `{a}`, `{R}`, `{b}`, `{raw}` (= treadRaw). Se `clamp==='min'` acrescente `fill(t.stt_bl_step_t_min,{min,T})`; se `'max'` `fill(t.stt_bl_step_t_max,{max,T})`. `{a}`/`{b}` formatados como em `formulaText` (inteiro sem casas).
   - passo 4 (destaque, mono, `role="status" aria-live="polite"`): linha `{a} × {R} + {b} × {T} = {S} cm` (S = `sum`), depois o estado com ícone e cor: `ok` → `✓ ` + `fill(t.stt_bl_ok,{min,max})` com `color:'var(--ok)'`; `warn` → `! ` + `fill(side==='below'? t.stt_bl_warn_below : t.stt_bl_warn_above,{d,min,max})` com `var(--warn)`; `bad` → `✕ ` + `fill(t.stt_bl_bad,{d,min,max})` com `var(--danger)`. `d` = `delta` em cm, 1 casa.
6. `<details open>` com `<summary>{t.stt_bl_words_title}</summary>` e `<p className="hint">{t.stt_bl_words}</p>`.
7. Nota por estilo: sempre `<p className="stt-ref">` com `t.stt_bl_note_straight`; se `type.runStyle==='post'` acrescente `<p className="hint" style={{color:'var(--warn)'}}>{t.stt_bl_note_curved}</p>`; senão só uma linha curta `t.stt_bl_note_curved_short`.
8. `<details>` fechado: `<summary>{t.stt_bl_presets_title}</summary>` e `<ul>` com 4 `<li>` (`stt_bl_p_hestia`, `stt_bl_p_nbr9050`, `stt_bl_p_nbr9077`, `stt_bl_p_ibc`) e `<p className="stt-ref">{t.stt_bl_p_foot}</p>`.
Sem cores literais (só tokens `var(--...)`). `fill` = o mesmo helper `(s, params)=>s.replace(/\{(\w+)\}/g, ...)` dos outros arquivos (copie, não exporte de outro lugar).
Teste (`StairBlondelCard.test.ts`, lang pt padrão do store; defina `useI18n.setState({lang:'pt'})` antes): com o tipo padrão e `heightCm=300` o HTML contém: `2·R + T = 63,0 cm`; `N = 17`; `17,6`; `27,8`; `28,0`; `2 × 17,6 + 28,0 = 63,2 cm`; `✓`. Com `heightCm=0` contém `stt_bl_invalid` traduzido (texto de `I18N.pt.stt_bl_invalid`). Com `runStyle:'post'` contém o texto de `stt_bl_note_curved`. Em `en` (`useI18n.setState({lang:'en'})`) contém `Blondel formula` e `63.2 cm`. Um teste confere que todas as chaves `stt_bl_*` existem em `I18N.pt` e `I18N.en` (compare os conjuntos de chaves iniciadas por `stt_bl_`).

## 3. `stairFieldVisibility.ts` e aplicação em `StairTypeSections.tsx`
```ts
import type { StairRunStyle } from '@hestia/model';
import type { StairFieldName } from './stairTypeForm.ts';
export type StairFormField = StairFieldName | 'materialId' | 'postMaterialId' | 'undersideStyle' | 'preset';
export function isStairFieldVisible(style: StairRunStyle, field: StairFormField): boolean;
export function visibleStairFields(style: StairRunStyle): StairFormField[];   // na ordem do tipo StairFormField abaixo
export type FieldLabelOverride = 'stt_f_material_lance' | 'stt_f_material_pisos' | 'stt_f_material_degraus' | 'stt_f_minTread_walk' | 'stt_f_treadThickness_post';
export function fieldLabelOverride(style: StairRunStyle, field: StairFormField): FieldLabelOverride | null;
```
Tabela (S = visível; – = oculto). Campos fora desta tabela (name, code, description, cost, runStyle) continuam sempre visíveis e NÃO entram no tipo `StairFormField`.

| Campo | monolithic | assembled | post |
|---|---|---|---|
| maxRiser, minRunWidth, minHeadroom | S | S | S |
| minTread | S | S | S (rótulo `stt_f_minTread_walk`) |
| nosing | S | S | – |
| preset, calcRiserFactor, calcTreadFactor, calcTarget, calcMin, calcMax, maxTread | S | S | S |
| materialId | S (`stt_f_material_lance`) | S (`stt_f_material_pisos`) | S (`stt_f_material_degraus`) |
| postMaterialId | – | – | S |
| structuralDepth, undersideStyle | S | – | – |
| treadThickness | – | S | S (rótulo `stt_f_treadThickness_post`) |
| riserThickness | – | S | – |
| treadOverlap | – | – | S |
| landingThickness | – | S | – |

Em `StairTypeSections.tsx`: envolva cada `row(...)`/select pelo teste `isStairFieldVisible(draft.runStyle, campo)` e use `fieldLabelOverride` no texto do `<label>` (na função `row`, `label = override ? t[override] : t[FIELD_LABEL[field]]`; nos selects de material idem). Os blocos `draft.runStyle === 'monolithic' ? ...` atuais podem ser trocados por essa função, mantendo ids (`stt-<campo>`), `onStyle`, validação e ordem. Na seção 2, abaixo da ajuda (`stt_calc_help`), se `runStyle==='post'`, mostre `<p className="hint">{t.stt_note_post_calc}</p>`. A seção 2 também ganha, logo abaixo da legenda `<legend>`, um `<p className="hint">` com `t.stt_calc_help_blondel` (texto curto apontando para o cartão à direita).
Não apague valores de campos ocultos (o modal já preserva com `preserveOnStyleChange`).
Testes (`stairFieldVisibility.test.ts`): reproduza a tabela acima inteira (loop sobre os 3 estilos e todos os campos, com `expect(isStairFieldVisible(style, field)).toBe(esperado)`); `visibleStairFields('post')` não contém `'nosing'`, `'structuralDepth'`, `'riserThickness'`, `'landingThickness'`, `'undersideStyle'`; contém `'treadOverlap'` e `'postMaterialId'`; `visibleStairFields('monolithic')` não contém `'treadThickness'`, `'treadOverlap'`, `'postMaterialId'`; `fieldLabelOverride('post','minTread')==='stt_f_minTread_walk'`, `fieldLabelOverride('monolithic','materialId')==='stt_f_material_lance'`, `fieldLabelOverride('monolithic','maxRiser')===null`.

## 4. `StairCalculatorPanel.tsx` (só o ramo do poste)
Hoje, no poste, o painel mostra apenas `t.stt_calc_no_rule`. Troque por: as linhas `Nº de espelhos` e `Espelho` (de `computeStairCalc`, quando `valid`) e depois `<p className="hint">{t.stt_calc_post_note}</p>`. As demais linhas (piso, soma, extensão, ângulo) não aparecem no poste. Não mude os outros ramos.

## 5. `StairTypeDialog.tsx` (só o JSX de `stt-side`)
Nova ordem: (1) prévia (o bloco `<div>` com título e `StairSectionPreview`), (2) `StairCalculatorPanel`, (3) `<StairBlondelCard type={draft} heightCm={calcHeight} />`. Passe `riser={calc?.valid ? calc.riser : undefined}` e `tread={calc?.valid ? calc.tread : undefined}` (remova o `&& !post`). Importe o cartão. Nada mais.

## 6. Chaves i18n a acrescentar (pt | en)
Parâmetros entre chaves `{x}`.
- `stt_bl_title`: `Fórmula de Blondel` | `Blondel formula`
- `stt_bl_intro`: `Regra do passo humano (François Blondel, séc. XVII): o espelho e o piso precisam combinar para a escada ser confortável. Quanto maior o espelho, menor deve ser o piso.` | `Rule of the human stride (François Blondel, 17th century): riser and tread must match for a comfortable stair. The taller the riser, the shorter the tread must be.`
- `stt_bl_range`: `Faixa aceita: de {min} a {max} cm. Fora dela o Hestia só mostra um aviso; nada é bloqueado.` | `Accepted range: {min} to {max} cm. Outside it Hestia only shows a warning; nothing is blocked.`
- `stt_bl_legend`: `R = espelho (altura de cada degrau) · T = piso (profundidade) · a e b = fatores do tipo` | `R = riser (step height) · T = tread (depth) · a and b = type factors`
- `stt_bl_live_title`: `Com a altura de {h} cm (calculadora):` | `With a floor-to-floor height of {h} cm (calculator):`
- `stt_bl_invalid`: `Informe uma altura e valores válidos para ver a conta.` | `Enter a height and valid values to see the calculation.`
- `stt_bl_step_n`: `Nº de espelhos: N = {h} ÷ {maxRiser} (espelho máximo) = {q}; arredonda para cima: N = {N}.` | `Number of risers: N = {h} ÷ {maxRiser} (maximum riser) = {q}; rounded up: N = {N}.`
- `stt_bl_step_r`: `Espelho: R = {h} ÷ {N} = {R} cm.` | `Riser: R = {h} ÷ {N} = {R} cm.`
- `stt_bl_step_t`: `Piso: T = ({target} − {a} × {R}) ÷ {b} = {raw} cm.` | `Tread: T = ({target} − {a} × {R}) ÷ {b} = {raw} cm.`
- `stt_bl_step_t_min`: ` Fica abaixo do piso mínimo ({min} cm); o Hestia usa {T} cm.` | ` That is below the minimum tread ({min} cm); Hestia uses {T} cm.`
- `stt_bl_step_t_max`: ` Fica acima do piso máximo ({max} cm); o Hestia usa {T} cm.` | ` That is above the maximum tread ({max} cm); Hestia uses {T} cm.`
- `stt_bl_ok`: `dentro de {min} a {max} cm` | `within {min} to {max} cm`
- `stt_bl_warn_below`: `{d} cm abaixo da faixa de {min} a {max} cm; só gera aviso` | `{d} cm below the range {min} to {max} cm; warning only`
- `stt_bl_warn_above`: `{d} cm acima da faixa de {min} a {max} cm; só gera aviso` | `{d} cm above the range {min} to {max} cm; warning only`
- `stt_bl_bad`: `{d} cm fora da faixa de {min} a {max} cm; só gera aviso` | `{d} cm outside the range {min} to {max} cm; warning only`
- `stt_bl_words_title`: `Como o Hestia usa` | `How Hestia uses it`
- `stt_bl_words`: `(1) Conta o menor número de espelhos que não passa do espelho máximo. (2) Divide a altura igualmente entre eles. (3) Calcula o piso pela fórmula, sem sair do piso mínimo e do máximo. (4) Compara a soma com a faixa e só avisa se sair dela. Nada impede você de desenhar do seu jeito: no croqui livre a regra não bloqueia.` | `(1) Takes the smallest number of risers that does not exceed the maximum riser. (2) Splits the height equally among them. (3) Computes the tread from the formula, within the minimum and maximum tread. (4) Compares the sum with the range and only warns when outside. Nothing stops you from drawing your own way: in a free sketch the rule does not block.`
- `stt_bl_note_straight`: `Vale no lance reto.` | `Applies to the straight flight.`
- `stt_bl_note_curved_short`: `Em escadas caracol e em leque, o piso é conferido na linha de caminhada.` | `In spiral and winder stairs the tread is checked on the walking line.`
- `stt_bl_note_curved`: `Em caracol e leque o piso muda com o raio. O Hestia confere o piso médio do lance (medido na linha de caminhada) e usa a regra do caracol nos avisos; aqui a conta mostra o lance reto de referência.` | `In spiral and winder stairs the tread changes with the radius. Hestia checks the mean tread of the flight (measured on the walking line) and uses the spiral rule in warnings; the calculation here shows the straight reference flight.`
- `stt_bl_presets_title`: `O que significam as predefinições` | `What the presets mean`
- `stt_bl_p_hestia`: `Padrão Hestia: 2R + T com alvo de 63 cm e faixa de 63 a 65 cm; espelho máx. 18, piso mín. 28 e máx. 32, largura 80 cm. Padrão do produto; a faixa é herdada da NBR 9050.` | `Hestia default: 2R + T with a 63 cm target and a 63 to 65 cm range; max riser 18, min tread 28 and max 32, width 80 cm. Product default; the range is inherited from NBR 9050.`
- `stt_bl_p_nbr9050`: `NBR 9050 (acessibilidade): faixa de 63 a 65 cm; espelho 16 a 18 e piso 28 a 32 cm, largura 120 cm. Fonte secundária: a conferir na norma vigente.` | `NBR 9050 (accessibility): range 63 to 65 cm; riser 16 to 18 and tread 28 to 32 cm, width 120 cm. Secondary source: check the current standard.`
- `stt_bl_p_nbr9077`: `NBR 9077 (saídas de emergência): faixa de 63 a 64 cm; espelho 16 a 18 e piso 28 a 32 cm, largura 110 cm. Fonte secundária: a conferir na norma vigente.` | `NBR 9077 (emergency exits): range 63 to 64 cm; riser 16 to 18 and tread 28 to 32 cm, width 110 cm. Secondary source: check the current standard.`
- `stt_bl_p_ibc`: `IBC (EUA): espelho máx. 7 pol (17,8 cm), piso mín. 11 pol (27,9 cm), largura 44 pol (111,8 cm). O IBC não tem fórmula de soma; a faixa de 60 a 65 cm é só uma aproximação do "Stair Calculator" do Revit usada pelo Hestia. A conferir.` | `IBC (USA): max riser 7 in (17.8 cm), min tread 11 in (27.9 cm), width 44 in (111.8 cm). The IBC has no sum formula; the 60 to 65 cm range is only an approximation of Revit's "Stair Calculator" used by Hestia. To be checked.`
- `stt_bl_p_foot`: `Valores de referência. Confira a norma vigente antes de usar.` | `Reference values. Check the current standard before use.`
- `stt_f_material_lance`: `Material do lance` | `Run material`
- `stt_f_material_pisos`: `Material dos pisos e espelhos` | `Treads and risers material`
- `stt_f_material_degraus`: `Material dos degraus` | `Treads material`
- `stt_f_minTread_walk`: `Piso mínimo (na linha de caminhada)` | `Minimum tread (on the walking line)`
- `stt_f_treadThickness_post`: `Espessura do degrau` | `Tread thickness`
- `stt_note_post_calc`: `No poste, a fórmula vale na linha de caminhada e só gera avisos.` | `For the post style, the formula applies on the walking line and only generates warnings.`
- `stt_calc_help_blondel`: `A fórmula de Blondel e a conta com a altura da calculadora estão no cartão à direita.` | `The Blondel formula and the calculation with the calculator height are in the card on the right.`
- `stt_calc_post_note`: `No poste o piso vem do croqui (linha de caminhada); a fórmula só gera avisos.` | `For the post style the tread comes from the sketch (walking line); the formula only generates warnings.`

## 7. Comandos (nesta ordem, sem erro)
```
cd C:\Users\Dennylson\Desktop\programas\Hestia\wt\integ2
npx vitest run apps/web
npx tsc --noEmit
npx eslint apps/web/src
```
## 8. Critérios de aceite
- Testes novos passam; os existentes (`stairTypeCalc.test.ts`, `stairTypeForm.test.ts` etc.) continuam passando.
- No modal: estilo monolítico não mostra Espessura do piso, Espessura do espelho, Sobreposição, Material do poste, Espessura do patamar; montado não mostra Espessura estrutural, Face inferior, Sobreposição, Material do poste; poste não mostra Nariz, Espessura estrutural, Face inferior, Espessura do espelho, Espessura do patamar. As regras de validação continuam as mesmas.
- O cartão mostra `2 × 17,6 + 28,0 = 63,2 cm` com o tipo padrão e 300 cm.
- Chaves pt e en iguais (o `tsc` acusa se faltar); nenhuma cor literal nova.
## 9. Commit
`git add apps/web/src/ui/dialogs apps/web/src/editor/i18n.ts && git commit -m "feat(web): cartão da fórmula de Blondel e campos do tipo de escada por estilo"` + linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. SEM push.

## RELATÓRIO FINAL (obrigatório, até 15 linhas)
Arquivos criados/editados; última linha de `vitest`, `tsc`, `eslint`; desvios e dúvidas (por exemplo, se algum campo do modal não encaixou na tabela).
