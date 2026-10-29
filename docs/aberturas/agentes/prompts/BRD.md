# Tarefa BRD · Diálogo completo, opções por família e catálogo brasileiro

Dois objetivos: (1) o diálogo "Propriedades do tipo" passa a expor **todas** as opções do tipo, mostrando só as que se aplicam à família (`openingOptionSupport`, `packages/model/src/openingSupport.ts`) e provando por teste que cada opção funciona; (2) o catálogo pré-cadastrado ganha os **tipos brasileiros usuais** (madeira, madeira e vidro, alumínio e vidro, vidro temperado, aço corta-fogo etc.).

Leia: `docs/aberturas/E3-spec-correcoes-v3.md` (§1, §4, §7, §8), `docs/aberturas/archicad/01-portas-configuracao.md` e `02-janelas-configuracao.md` (como o ArchiCAD organiza abas e campos; em especial o §5 de nomes em português da UI BRA do R1), `docs/aberturas/archicad/04-brasil-tipos-e-normas.md` (§3 a §5 e §8: tipos, medidas, parâmetros), `packages/model/src/openingTypes.ts` (todos os campos do tipo), `openingStyle.ts`, `openingSupport.ts`, `opening.ts`, `defaults.ts` (`DEFAULT_OPENING_TYPES`), `apps/web/src/ui/dialogs/openingType/*`, `openingTypeForm.ts` e seus testes.

Outra tarefa (BRM) está implementando no motor/3D/planta os campos `boards`/`fullglass`, `glassRatio`, `hinges`, `threshold`, `leafMaterialId`, `glassKind`, `reveal`; você só os **expõe** e os grava no tipo.

## Arquivos permitidos
`apps/web/src/ui/dialogs/openingType/*`, `apps/web/src/ui/dialogs/openingTypeForm.ts` (+ testes), `packages/model/src/openingSupport.ts` (+ teste), `packages/model/src/opening.ts` (só `openingTypeIssue`: validar os campos novos), `packages/model/src/defaults.ts` (**somente** `DEFAULT_OPENING_TYPES`, acrescentando no fim; não mexa nos materiais), testes de catálogo existentes que contam tipos (liste). `apps/web/src/styles.css` só no bloco `.dialog.xl`.

## 1 · Diálogo
- Campos novos a expor (cada um no grupo certo, com rótulo em português): profundidade do batente (`frameDepthMode`: "Acompanha a parede" / "Só o núcleo" / "Fixa" + valor quando fixa), recuo (`reveal.depth` em cm e âncora face/núcleo), alizar (largura, espessura, `sides`: ambas as faces/lado da abertura/lado oposto), estilo de folha (acrescentar "Lambri (macho e fêmea)" e "Vidro total"), `glassRatio` (presets 1/4, 1/2, 3/4 e valor livre), maçaneta, dobradiças (2/3/4), soleira (ligar, espessura, material), material da folha, tipo de vidro (com amostra de cor), eixo da basculante (`tiltAxis` em % da altura), bandeira de janela (altura, fixa ou maxim-ar), ângulos 2D/3D, estilo do batente.
- **Mostrar só o que se aplica**: cada grupo/campo some (ou fica desabilitado com dica "não se aplica a <família>") conforme `openingOptionSupport(familyId)`. Troca de família: campos que deixam de se aplicar **não são apagados** do tipo, mas ficam ocultos e sem efeito; ao voltar, reaparecem.
- Função pura nova `openingFormFields(familyId): FormFieldId[]` (lista dos campos visíveis, na ordem de exibição) usada pelo diálogo e pelos testes. Seletores mostram o **valor efetivo** (leitores `opening*`), gravando só o que difere do padrão (`withOpeningField`, já existe).
- As amostras de cor do vidro e dos materiais usam as variáveis de tema; sem cores fixas fora de amostras.
- `openingTypeIssue` valida os campos novos: `frameDepthMode` ∈ conjunto, `reveal.depth` 0..0,15, `casing.sides` ∈ conjunto, `glassRatio` 0,1..0,9, `hinges` inteiro 2..4, `threshold.thickness` 0,005..0,08, `tiltAxis` 0,2..0,8, `glassKind` ∈ conjunto, `leafStyle` incluindo `boards`/`fullglass`.

## 2 · Catálogo brasileiro (acrescente ao fim de `DEFAULT_OPENING_TYPES`, com `code`, `name` e `description` citando a norma/uso)
Convenção de nomes: nas portas de madeira o número é a **folha** e o vão vem entre parênteses (NBR 15930-2: vão = folha + 80 mm de largura e + 50 mm de altura): `Porta madeira lisa 80 (vão 88×215)`. `width`/`height` do tipo são o **vão** (estes valores).
- Portas de madeira: lisa/semi-oca 70, 80, 90 (`flush`, 3 dobradiças, maçaneta alavanca); almofadada 80 (`panel`); madeira e vidro 1/2 e 3/4 (`glass`, `glassRatio` 0,5 e 0,75); veneziana 80 (`louver`); lambri 80 (`boards`); com bandeira 80 (`transom`); de abrir 2 folhas 160 (`door_double`); de correr embutida 80 (`door_pocket`); banheiro 70 (lisa, vão 78×215, sem soleira).
- Alumínio e vidro: porta de giro 80 (`fullglass`, material alumínio, vidro liso); porta-balcão de correr 2 folhas 150×215 (`door_sliding`, alumínio, vidro liso, trilho).
- Vidro temperado: porta de giro 90 (`fullglass`, `glassKind 'tempered'`, `frameStyle 'block'`, puxador); porta de correr 2 folhas 160 (idem).
- Aço: porta corta-fogo P-60 90 (`flush`, material aço, `fireRating 'P-60'`).
- Janelas de alumínio: correr 2 folhas 100×100, 120×120, 150×120 (já existem alguns: não duplique); correr 3 folhas com bandeira 200×150 (bandeira fixa 0,30); correr 4 folhas 240×120; maxim-ar 100×60 e 60×60 (peitoril 1,40); basculante 60×60 e 40×40 (já há `ot_jb80`); fixa vidro temperado 150×120; de abrir madeira 2 folhas 120×120 (já existe); guilhotina madeira (já existe); com vidro canelado 60×60 (banheiro, `glassKind 'ribbed'`); pivotante (já existe); veneziana (já existe).
Cada tipo novo passa por `openingTypeIssue`, cai na família certa e (quando a tarefa BRM estiver integrada) gera modelo sem erro. Atualize os testes que contam o catálogo (liste).

## Critérios de aceitação (testes vitest; sem navegador)
- `openingFormFields` por família: por exemplo `door_garage` não lista maçaneta/bandeira/soleira; `window_louver` não lista bandeira/grade; `window_tilt` lista `tiltAxis`; `door_swing` lista todas as de porta de giro; ordem estável. Toda opção marcada `true` em `openingOptionSupport` aparece em `openingFormFields` e vice-versa (teste de consistência).
- Render do diálogo (react-dom/server) para 4 famílias (porta de giro, correr, janela fixa, basculante) mostra exatamente os campos de `openingFormFields` (rótulos esperados) e nenhum a mais.
- Cada campo do formulário, ao ser alterado pelas funções puras do formulário, muda o tipo apenas no campo correto e devolve o padrão (campo removido) ao voltar ao valor padrão.
- **Auditoria de funcionamento**: para cada família e cada campo **visível** dela, aplicar um valor não padrão ao tipo e conferir que `buildOpeningModel` sobre uma abertura desse tipo muda a assinatura do modelo (campos já implementados no motor: os demais ficam num `it.todo` com a lista, até a tarefa BRM ser integrada). Qualquer campo visível que não muda nada nem tem `it.todo` justificado é defeito: corrija ocultando-o ou aponte no relatório.
- `openingTypeIssue` recusa os valores inválidos da lista acima.
- O catálogo: todos os tipos novos têm `code` único, passam em `openingTypeIssue`, `openingFamilyOf` devolve a família esperada.
- `tsc`, `check-boundaries`, `npx vitest run apps/web/src/ui packages/model` verdes.
