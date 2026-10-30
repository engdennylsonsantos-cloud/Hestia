# Modal de TIPO de escada: auditoria e especificação

Base: wt/escada-calculo. Caminhos relativos a apps/web/src/ui salvo indicação. "STD" = dialogs/StairTypeDialog.tsx.

## 1. AUDITORIA

### Estrutura e agrupamento
- STD:89-142: 14 campos numa coluna plana, sem seções. Mistura regra de cálculo (maxRiser, minTread, minRunWidth), construção (espessuras, nariz, material) e identificação (código, descrição, custo), sem ordem lógica. Código, Descrição e Custo ficam depois de Material, no fim.
- STD:89-92: "Nome do tipo" fica separado de Código/Descrição (STD:140-141).
- STD:133: "Folga de cabeça mínima" entre Patamar e Material, embora seja regra de abertura/cálculo. A abertura da laje (openingMode etc.) é do Stair (StairProperties.tsx:110-131), não do tipo; o usuário não vê a relação.
- STD:132: espessura do patamar misturada com as espessuras do lance.

### Rótulos e unidades
- Unidade no rótulo, em texto livre e inconsistente: "(cm)" em STD:101-132, "(m)" em STD:133. NumField tem prop `unit` (fields.tsx:9-10,86), não usada aqui; StairRunOptionsBar.tsx:60,76 usa `unit="m"`.
- STD:106: "Espessura estrutural (perpendicular à rampa) (cm)": dois parênteses e estoura a coluna de 110px (`.field-row`, styles.css:471).
- A regra de cálculo (0,63 − 2R, piso máx. 0,32) está fixa no motor (packages/engine/src/stairGenerators.ts:56 `MAX_TREAD`, :66 `treadFor`) e NÃO aparece na UI: regra invisível.
- Estilo (STD:13): "Monolítico (concreto)", "Piso e espelho (montado)", "Poste central", sem descrição do que muda.
- "Nariz" (STD:131) não diz que só afeta 3D/quantitativo (stairTypes.ts:136).
- "Custo (R$)" só tem `title` (STD:142), inacessível por teclado.

### Validação e feedback
- STD:143: um único erro, no fim da coluna (pode ficar fora da rolagem); sem destacar o campo, sem aria-invalid/aria-describedby; cor com fallback hardcoded `#b42318` (o token `--danger` existe, styles.css:21).
- stairTypeError (editor/stairTypeActions.ts:47-58) devolve só a 1ª mensagem. Não valida: 2R+T de minTread/maxRiser fora de faixa, minTread > piso máximo, nosing >= minTread, cost. treadOverlap fica em stairTypeIssue (model/src/stair.ts:114).
- NumField (fields.tsx:44-60) faz clamp silencioso com `min` (digitar 0 vira 0,01 cm sem aviso). `strictRange`/`onInvalid` existem e não são usados.
- OK/Aplicar desabilitados (STD:83-84) sem motivo visível (só `title` no OK).
- Sem aviso de impacto: alterar maxRiser regenera escadas existentes; "usada em N" só no sub (STD:75).
- Sem estado "alterado": Cancelar/Esc descartam sem confirmar.
- Trocar estilo (STD:37-44) zera campos sem avisar e perde o que o usuário digitou.

### Prévia
- StairSectionPreview.tsx:11-43, stairSectionProfile.ts:19-31: 3 degraus com maxRiser/minTread (não os valores calculados); sem cotas gráficas (só texto fontSize 0.12 em unidades de mundo, StairSectionPreview.tsx:34-36, ilegível, tamanho varia com o painel); sem nariz, pé-direito, patamar.
- Fallbacks de cor hardcoded (`rgba(60,110,200,.18)`, `#333`). aria-label fixo (l.28).
- Hint STD:147-149 longo e técnico.

### Teclado e acessibilidade
- Dialog.tsx:5-12: só Esc (fecha sem confirmar). Sem Enter/Ctrl+Enter para OK, sem trap de foco, sem foco inicial, sem devolver foco ao fechar.
- Erros só por cor+texto no fim, sem aria-invalid.
- NumField faz `stopPropagation` em todo keydown (fields.tsx:86) e engole atalhos do diálogo.

### i18n
- Tudo hardcoded em pt-BR (STD:13-14,75,89-148; StairSectionPreview.tsx:30-31; stairTypeError/stairTypeIssue). O app tem `I18N`/`useI18n` (editor/i18n.ts; exemplo CeilingScheduleDialog.tsx:5,39,56) e nenhum diálogo de tipo o usa. Formatação `.replace('.', ',')` fixa em vez de toLocaleString com lang (CeilingScheduleDialog.tsx:39 mostra o padrão certo).

### Outros pontos
- StairProperties.tsx:199-203: hint repete só "Espelho máximo X cm"; rótulos "(m)" em :118,130 contra `unit` em :105-106 (mesma inconsistência).
- StairRunOptionsBar.tsx:114-118: tipo por `<select>` simples; ToolTypeProps.tsx usa `TypeSelector` nas demais ferramentas. Conferir se escada usa o mesmo.

## 2. Sistema de design existente (reutilizar)
- `Dialog` (dialogs/Dialog.tsx), `size="mid"` 700px; max-height 660px (styles.css:365-367, `.xl` :393).
- `TypeDialogHeader` + `FAMILY.stair`; rodapé Excluir (btn danger) / Cancelar / Aplicar / OK (btn primary), como em SlabTypeDialog.tsx:93-101; rascunho com `structuredClone` e reset ao trocar `typeId`.
- CSS: `.field-row` (:471), `.split` (:376), `.dtabs/.dtab` (:373-375; WallTypeDialog.tsx:109), `.pgroup` (:176-181), `.hint`, `.unit`, `.numwrap`, `.input.num`, `.vr-error` (:261), tokens `--ok --warn --danger --accent --accent-soft --fg-soft --fg-faint --line --chrome --panel` (:20-22; escuro :50-52,:77-79). Rótulo de seção em caps pequenos: SlabTypeDialog.tsx:115.
- Componentes: NumField (`unit`, `strictRange`, `onInvalid`, `onValid`), TextField, Check, Row, Group (fields.tsx).
- Preferir seções a abas: a Calculadora precisa ficar visível ao editar.

## 3. ESPECIFICAÇÃO

### 3.1 Layout
`<Dialog size="wide">` (novo `.dialog.wide { width: min(940px,100%) }`). Corpo:
1. `TypeDialogHeader` (inalterado).
2. Campo "Nome do tipo" logo abaixo (id `stt-name`; "Renomear…" depende dele).
3. Grid `.stt-grid`: `minmax(0,1.4fr) minmax(280px,1fr)`; abaixo de 760px, 1 coluna.
   - Esquerda (rolável): seções 1 a 5 em `<fieldset className="dsec"><legend>`, legenda em caps pequenos.
   - Direita (sticky): painel Calculadora e, abaixo, Prévia do corte.
4. Rodapé igual ao atual, mais contador "N erros, M avisos" e dica "Ctrl+Enter = OK".
Sub: `Escada · usada em N escadas` / `Stair · used by N stairs`.

### 3.2 Seções e campos
Valores internos em metros; exibição em cm com `scale={100}` + `unit="cm"` (unidade NUNCA no rótulo). Exceção: pé-direito em m (`unit="m"`). N = NumField, S = select, T = TextField, C = Check.

**1. Dimensões / Dimensions**
| Campo | pt | en | Un | Limites | Ctl |
|---|---|---|---|---|---|
| maxRiser | Espelho máximo | Maximum riser | cm | 10 a 25 (aviso fora de 15-19) | N dec 1 |
| minTread | Piso mínimo | Minimum tread | cm | 15 a 45 | N dec 1 |
| minRunWidth | Largura mínima do lance | Minimum run width | cm | 40 a 300 | N dec 1 |
| minHeadroom | Pé-direito livre mínimo | Minimum headroom | m | 1,80 a 3,00 | N dec 2 |
| nosing | Nariz (só 3D e quantitativos) | Nosing (3D and quantities only) | cm | 0 a minTread−1 | N dec 1 |

**2. Cálculo do piso / Tread calculation**
Ajuda fixa: pt "Piso = (alvo − a·espelho) ÷ b, limitado entre o piso mínimo e o máximo." / en "Tread = (target − a·riser) ÷ b, clamped between minimum and maximum tread."
| Campo | pt | en | Un | Limites | Ctl |
|---|---|---|---|---|---|
| (preset) | Predefinição | Preset | , | lista abaixo | S |
| calcRiserFactor | Fator do espelho (a) | Riser factor (a) | , | 0,5 a 4 | N dec 2 |
| calcTreadFactor | Fator do piso (b) | Tread factor (b) | , | 0,5 a 4 | N dec 2 |
| calcTarget | Alvo de a·R + b·T | Target of a·R + b·T | cm | 40 a 100 | N dec 1 |
| calcMin | Resultado mínimo | Minimum result | cm | 40 a calcMax | N dec 1 |
| calcMax | Resultado máximo | Maximum result | cm | calcMin a 100 | N dec 1 |
| maxTread | Piso máximo | Maximum tread | cm | minTread a 60 | N dec 1 |
Padrões: a=2, b=1, alvo 63, min 63, max 65, piso máx. 32. Regra: `T = clamp((alvo − a·R)/b, minTread, maxTread)` (generaliza `treadFor`).

Predefinições (aplicam valores; não são gravadas; "Personalizado" aparece sozinho quando nenhum casa). VALORES SÃO PROPOSTAS, o dono deve confirmar com a norma vigente:
- Padrão Hestia: a=2 b=1 alvo 63 min 63 max 65; espelho máx. 18; piso mín. 28; piso máx. 32.
- NBR 9050: espelho 16-18, piso 28-32, 63-65 cm. Aplica maxRiser 18, minTread 28, maxTread 32, min 63, max 65, alvo 64, largura 120.
- NBR 9077: espelho 16-18, piso 28-32, 2R+T 63-64. Aplica maxRiser 18, minTread 28, maxTread 32, min 63, max 64, alvo 63,5, largura 110.
- IBC: espelho máx. 7 in (17,8 cm), piso mín. 11 in (27,9 cm), sem fórmula obrigatória (usar 61-65 informativo), largura 44 in (111,8 cm). Aplica maxRiser 17,8, minTread 27,9, maxTread 40, min 61, max 65, alvo 63, largura 111,8.
Aplicar preset = um único `set(patch)`; aviso inline `aria-live=polite` "Predefinição aplicada". Botão "Restaurar valores do preset" quando algum campo diverge. Rodapé da seção: "Valores de referência; confira a norma vigente."

**3. Construção / Construction**
| Campo | pt | en | Un | Limites | Ctl |
|---|---|---|---|---|---|
| runStyle | Estilo | Style | , | 3 estilos | S + descrição |
| materialId | Material | Material | , | , | S |
| structuralDepth | Espessura estrutural (perpendicular à rampa) | Structural thickness (perpendicular to slope) | cm | 5 a 60 | N (monolítico) |
| undersideStyle | Face inferior | Underside | , | lisa/escalonada | S (monolítico) |
| treadThickness | Espessura do piso (degrau no poste) | Tread thickness | cm | 0,5 a 15 | N (montado, poste) |
| riserThickness | Espessura do espelho | Riser thickness | cm | 0,5 a 10 | N (montado) |
| treadOverlap | Sobreposição dos degraus | Tread overlap | cm | 0 a treadThickness−0,1 | N (poste) |
| postMaterialId | Material do poste | Post material | , | , | S (poste) |
| landingThickness | Espessura do patamar | Landing thickness | cm | 5 a 50 | N |
Descrição do estilo sob o select: monolítico "Laje de concreto contínua; define espessura estrutural e face inferior."; montado "Pisos e espelhos montados sobre estrutura."; poste "Degraus em balanço presos a um poste central; sem espelho."
Trocar estilo: guardar valores dos campos ocultos num useRef e restaurá-los ao voltar (hoje STD:37-44 zera). Só gravar 0 nos não aplicáveis no upsert final (exigido por stairTypes.ts:103-104). Campos não aplicáveis ficam ocultos, não desabilitados.

**4. Abertura da laje / Slab opening**
O modo é do exemplar (Stair, stairTypes.ts:62-90), não do tipo. Seção SOMENTE LEITURA: texto "O furo no modo Pé-direito usa o pé-direito livre mínimo (Dimensões). Modo, folga lateral e furo retangular se ajustam nas propriedades de cada escada." / en equivalente, com botão "Ir para propriedades" (desabilitado sem escada selecionada). Não criar campos no modelo. Padrão por tipo seria mudança de modelo à parte.

**5. Identificação / Identification** (colapsável, fechada por padrão)
| Campo | pt | en | Ctl |
|---|---|---|---|
| code | Código | Code | T |
| description | Descrição | Description | T |
| cost | Custo (informativo) | Cost (informational) | N dec 2, `unit="R$"`, min 0 |
O Nome fica fora da seção, no topo (3.1).

### 3.3 Painel "Calculadora" (ao vivo)
Entrada de simulação, NÃO persistida no tipo: "Altura piso a piso" N cm, padrão 300 (safeGet/safeSet, chave `hestia.stt.calcH`). Saída somente leitura (`.prow.ro`, fonte mono):
1. Nº de espelhos N = `riserCountFor(H, maxRiser)`.
2. Espelho R = H ÷ N.
3. Piso T = clamp((alvo − a·R)/b, minTread, maxTread).
4. a·R + b·T, rótulo dinâmico com a e b reais (ex.: "2·R + T = 63,3 cm").
5. Indicador (ícone + texto, nunca só cor), `role="status" aria-live="polite"`:
   - verde (`--ok`) "Dentro da faixa": calcMin ≤ valor ≤ calcMax (tolerância 0,05 cm);
   - amarelo (`--warn`) "Fora da faixa por X cm": diferença ≤ 3 cm (típico: piso limitado por mín./máx.);
   - vermelho (`--danger`) "Fora da faixa": diferença > 3 cm, ou piso mínimo > piso máximo, ou entradas inválidas.
6. Extensão horizontal (N−1)·T e inclinação atan(R/T) em graus.
Atualiza a cada commit de campo. A função pura `computeStairCalc` é a MESMA usada pelo motor, para nunca divergir. Barra opcional com marcadores min/max e ponto atual (SVG aria-hidden).
Escada com poste (sem espelho/regra própria): mostrar aviso "A regra de cálculo não se aplica ao estilo poste/caracol" em vez de resultados.

### 3.4 Prévia (corte do lance com cotas)
StairSectionPreview passa a receber `{type, riser, tread}` calculados. 3 degraus. Elementos:
- Cotas desenhadas (linha fina com ticks): espelho R, piso T, balanço do nariz, espessura (estrutural / piso / espelho / degrau conforme estilo), pé-direito mínimo (linha tracejada `--danger` sobre um degrau).
- Rótulos em HTML posicionado sobre o SVG ou em unidades corrigidas para tamanho de fonte constante (hoje 0,12 em unidades de mundo); `vector-effect: non-scaling-stroke`.
- Linha do chão rotulada "Nível"/"Level".
- aria-label dinâmico e traduzido: "Corte do lance: espelho 17,6 cm, piso 28 cm, estilo monolítico".
- Cores só por tokens, sem fallbacks hardcoded.
- Vazio: R ou T inválidos → "Preencha espelho e piso para ver o corte."
- Reaproveitar stairSectionProfile.ts e stairPostTreads (testes existentes: stairSectionProfile.test.ts); trocar entradas por riser/tread e devolver âncoras de cota.

### 3.5 Validação inline
- Mensagem por campo em `<div className="vr-error" id="stt-X-err">` abaixo da linha, `aria-invalid` e `aria-describedby` no input (estender NumField em fields.tsx com `invalid` e `describedBy`).
- `strictRange` + `onInvalid` nos NumField com limites de 3.2: valor fora volta ao último válido e mostra "Informe um valor entre X e Y cm" (limpa por `onValid`).
- Regras cruzadas (reportar TODAS): minTread ≤ maxTread; calcMin ≤ calcTarget ≤ calcMax; a,b > 0; nosing < minTread; treadOverlap < treadThickness (poste); nome obrigatório; materiais existentes.
- Avisos não bloqueantes (amarelo): a·maxRiser + b·minTread fora de [calcMin, calcMax]; espelho máx. > 19 cm; piso mín. < 25 cm.
- OK/Aplicar desabilitados com `aria-disabled` e motivo em texto no rodapé; contador "2 erros, 1 aviso" focando o 1º campo inválido.
- `stairTypeError` passa a ter irmã `validateStairType(t): Issue[]` com `{field, severity, code, params}`; `stairTypeError` fica como wrapper (1ª mensagem de erro) para compat com stairTypeActions.test.ts:58-70 e commands.ts:40.

### 3.6 Teclado
- Foco inicial: Nome (ou Estilo em tipo novo).
- Enter em NumField confirma o campo (já); Ctrl+Enter = OK se válido; Ctrl+S = Aplicar; Esc = Cancelar, com confirmação "Descartar alterações?" se houver alterações.
- Alt+1..5 foca o 1º campo da seção.
- Trap de foco (Tab/Shift+Tab cíclico) e devolução do foco ao fechar (em Dialog.tsx, via prop opcional para não afetar os outros diálogos).
- Ordem de tab: Nome, seções 1 a 5, altura simulada, rodapé. A prévia não recebe foco.
- Handler em captura no `.dialog` (como o Esc, Dialog.tsx:7-12), porque NumField dá `stopPropagation` (fields.tsx:86). Ignorar quando um `<select>` está aberto.

### 3.7 Estados vazios e de erro
- Tipo inexistente (hoje `return null`, STD:30): mostrar "Este tipo não existe mais." com botão Fechar.
- Sem materiais: selects desabilitados com "Nenhum material" e erro "Cadastre um material".
- Entradas inválidas (maxTread < minTread, H ≤ 0): Calculadora mostra "—" e indicador vermelho; sem exceção (riserCountFor lança RangeError, stairGenerators.ts:59-60: pré-checar).
- Tipo em uso: aviso "Alterar estes valores regenera as N escadas que usam este tipo." quando N > 0 e maxRiser/minTread/fatores mudaram.
- Exclusão bloqueada: motivo visível no rodapé, além do `title`.

### 3.8 i18n
- Chaves `stt_*` em editor/i18n.ts nos blocos `pt` e `en` (como `tool_stair`, :66 e :196): `stt_title`, `stt_sec_dims|calc|build|opening|id`, `stt_f_<campo>`, `stt_preset_*`, `stt_calc_*`, `stt_err_*`, `stt_warn_*`. Uso: `const t = I18N[useI18n((s) => s.lang)]`. Mensagens com parâmetros via template `{x}`.
- Validação devolve códigos + params; a UI traduz (nada de pt fixo em packages/model para o novo código).
- Números: helper `fmtNum(v, dec, lang)` com toLocaleString (padrão CeilingScheduleDialog.tsx:39). NumField mostra vírgula fixa (fields.tsx:6); em `en` isso fica fora do escopo (afeta o app todo) e `parseNumber` aceita ambos; registrar como pendência.
- Estender editor/i18n.test.ts para exigir que toda `stt_*` exista nos dois idiomas.

### 3.9 Arquivos
Criar (apps/web/src/ui/dialogs/):
- `stairTypeCalc.ts` + `.test.ts`: `computeStairCalc`, `STAIR_CALC_PRESETS`, `matchPreset`, `applyPreset`. A parte pura vai para packages/engine (ou model) para o motor usar a mesma `treadFor(R, type)`.
- `stairTypeForm.ts` + `.test.ts`: `validateStairType`, limites, preservação de campos ao trocar estilo.
- `StairCalculatorPanel.tsx`.
- `StairTypeSections.tsx` (opcional, separa as seções).
Alterar:
- `dialogs/StairTypeDialog.tsx`: reescrever (seções, painel, atalhos, dirty, i18n).
- `dialogs/StairSectionPreview.tsx`, `dialogs/stairSectionProfile.ts` (+ teste): riser/tread calculados, cotas, nariz, pé-direito.
- `fields.tsx`: NumField com `invalid`/`describedBy`; `Section` opcional.
- `dialogs/Dialog.tsx`: `size="wide"`, trap/devolução de foco, `onSubmit` opcional.
- `src/styles.css`: `.dialog.wide`, `.dsec`, `.stt-grid`, `.calc-badge.ok|warn|bad` (tokens), reuso de `.vr-error`.
- `editor/i18n.ts` (+ teste): chaves `stt_*`.
- `editor/stairTypeActions.ts`: issues estruturadas; `duplicateStairType` copia os campos novos.
- packages/model `stairTypes.ts`, `stair.ts` (COMMON :36-46), `migrate.ts`, esquema (esquema.test.ts): campos novos, defaults, migração (a=2, b=1, alvo 0,63, min 0,63, max 0,65, maxTread 0,32), `stairTypeIssue` com a,b>0 e minTread ≤ maxTread. (Outro agente.)
- packages/engine/src/stairGenerators.ts: `treadFor`/`MAX_TREAD` leem o tipo. Chamadores: packages/tools/src/stairRunPlan.ts:70-139, stairRunEdit.ts:10-26, stairRunTool.ts:234-258, stairCommands.ts:30.
- Opcional: StairProperties.tsx:199-203 (hint com a regra do tipo).

## 4. RISCOS E TESTES
Riscos:
1. Semântica do piso: o motor usa 0,63−2R e 0,32 fixos. Sem migração exata dos padrões, escadas e testes de motor (stairBody, stairChecks, stairQuantities) mudam. Exigir teste golden sobre DEFAULT_STAIR_TYPES.
2. Dependência do outro agente (nomes dos campos, migração): o modal deve tolerar `undefined` com `?? padrão` até a migração existir.
3. b = 0 ou negativo; alvo − a·R ≤ 0 cai no piso mínimo; validar a, b > 0.
4. Presets de norma: valores propostos, erro tem peso profissional; rotular "valores de referência" e o dono confirmar.
5. Caracol/leque/poste usam regra própria (stairChecks); a Calculadora não se aplica.
6. NumField: `stopPropagation` engole atalhos; `strictRange` muda comportamento (volta o valor em vez de clamp): usar só onde especificado.
7. Alterar o tipo regenera escadas existentes: aviso + um único passo de desfazer.
8. Layout em 700 a 1280px e DPI alto; max-height 660px: coluna esquerda rolável.
9. Campos ocultos preservados não podem vazar para o upsert (zerar ao gravar).
10. Troca de tipo no TypeDialogHeader com alterações perde o rascunho (hoje também): confirmar.
11. Contraste do verde/amarelo/vermelho nos dois temas; sempre ícone + texto.
Testes:
- Unit `computeStairCalc`: H=300, maxRiser 18 → N=17, R=17,65, T=clamp(63−35,3=27,7→28), soma 63,3; clamp mín. e máx.; tolerância de faixa; presets e `matchPreset`/Personalizado; b=0; maxTread<minTread; H=0/NaN.
- Unit `validateStairType`: cada regra cruzada, dependência de estilo, múltiplos erros; testes atuais de `stairTypeError` (58-70) verdes.
- Unit prévia: `stairSectionProfile` com riser/tread explícitos e âncoras de cota.
- Modelo: migração de projeto antigo, roundtrip do esquema, `duplicateStairType` copia campos novos.
- Motor: `treadFor` com padrões igual ao anterior (golden); com fatores custom, esperado.
- Componente (se houver Testing Library/jsdom): valor inválido mostra erro inline e mantém OK desabilitado; Ctrl+Enter/Ctrl+S/Esc com confirmação; foco inicial; troca de estilo preserva campos; paridade de chaves i18n pt/en.
- Manual: tema claro/escuro, 700 e 940 px, só teclado, leitor de tela (aria-live), desfazer após Aplicar e OK, tipo em uso por escadas existentes.
