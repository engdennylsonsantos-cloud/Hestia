# Render · textos e cotas de anotação (seleção, hover, moldura e alça)

Área: `packages/render/src/plan` (só `notes.ts`, `planOverlay.ts`, `planFrame.ts`, `types.ts`, `index.ts` e testes).

## Assinaturas

```ts
// notes.ts
export interface NoteLook {
  ink: string;
  select: string;
  /** Cor do realce sob o cursor (ausente usa `select`). */
  hoverColor?: string;
  paper?: string;
  selection: Id[];
}

export function noteOps(
  p: Project,
  levelId: Id,
  pt: PlanPaint,
  look: NoteLook,
  scale: number,
  v?: Viewport,
  annotations?: AreaPlanAnnotations,   // plan.annotations da vista; sem ela, as do nível
): NoteOps;

// Hover/seleção em camada própria (sem refazer a geometria do nível)
export interface NoteTarget { selection?: readonly Id[]; hover?: Id | null }
export function annotationHighlightOps(
  p: Project,
  levelId: Id,
  scale: number,
  look: Pick<NoteLook, 'select' | 'paper' | 'hoverColor'>,
  target: NoteTarget,
  annotations?: AreaPlanAnnotations,
): NoteOps;

// Auxiliares exportados (caixa do texto, quebra de linha e anotações da vista)
export function linhasDoTexto(text: string, fontMm: number, widthMm?: number): string[];
export function textBlockModel(t: Pick<TextNote, 'text' | 'height' | 'width'>, escala: number): { lines: string[]; w: number; h: number };
export function blocoEm(at: Vec2, w: number, h: number, rotation: number, folga?: number): Vec2[];
export function drawnAnnotations(p: Project, levelId: Id, plan?: AreaPlan): AreaPlanAnnotations;
```

`LabelOp` ganhou `whiteSpace?: 'pre-wrap' | 'nowrap' | 'normal'` (`types.ts`), comparado em `sameLabels`
(`planFrame.ts`), para a tela preservar `\n` e a quebra por `widthPx`.

## O que entra no desenho

- **Texto selecionado** (`noteOps` e `annotationHighlightOps`): o rótulo sai com `color: look.select`, um contorno
  fechado em volta do bloco (`blocoEm` com folga `MOLDURA_MM + SELECAO_MM`, 2 px) e o **quadradinho** da alça.
- **Quadradinho da alça**: `quadradoEm(t.at, ALCA_TEXTO_PX)` — marcador em pixels (`deslocamentoPx`, meio lado 4 px),
  preenchimento branco + contorno de 1,5 px na cor de seleção, ancorado em `text.at` (o ponto que o `selectTool` usa
  para pegar/arrastar o texto: `textHit`). Não depende do zoom e não desloca os demais vértices.
- **Hover** (`annotationHighlightOps` chamado pelas camadas de hover): realce leve — preenchimento `alpha 0.12` e
  contorno de 1,2 px `alpha 0.7` na cor `hoverColor`/`select` — em volta do bloco do texto; para cotas, o mesmo realce
  cerca o valor (a seleção da cota continua só por cor, com as alças de sempre). Nada de rótulo duplicado.
- **Cota selecionada**: continua tingida pela cor de seleção em `noteOps` (linha, chamadas, marcas e valor), inclusive
  quando vem de `plan.annotations` (o id da vista entra em `planGeometrySelection`).
- **`TextNote.frame`**: preenchimento do papel (`look.paper`, alpha 1) atrás do bloco e contorno fechado na cor da
  anotação (ou de seleção). `width` (mm de papel) limita a largura e quebra as linhas (`linhasDoTexto`); o `\n` do
  modelo é preservado. A fonte e a quebra na tela saem de `LabelOp.papel` + `whiteSpace: 'pre-wrap'`.

## Caminhos

- `buildPlanSelectionOverlay` / `buildPlanHoverOverlay` / `buildPlanOverlay` (`planOverlay.ts`) juntam
  `annotationHighlightOps` com `drawnAnnotations` (vista ou nível, filtrado pelo perfil da planta de área).
- `planFrame.ts`: as camadas `overlay` e `hover` da planta de área juntam `areaPlanHighlightOps` ao destaque das
  anotações (`juntarOps`), com a seleção/hover do estado do quadro.
- `packages/render/src/index.ts` exporta `noteOps`, `annotationHighlightOps`, `drawnAnnotations`, `textBlockModel`,
  `linhasDoTexto`, `blocoEm` e os tipos `NoteLook`, `NoteOps`, `NoteTarget`, `TextBlockModel`.

Observação: o app (`PlanLabels.tsx`, fora desta área) também desenha moldura de fallback e alça de arraste do texto;
com o render emitindo `frame`/seleção, o desenho do app passa a ser redundante na tela (o PDF/prancha usa o render).

## Testes

```powershell
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/render/src/plan --exclude "**/ouroZoom.test.ts"
```

`ouroZoom.test.ts` foi excluído: o JSON de referência está sendo regerado por trabalho concorrente (áreas de
planta de área/escadas) e as 72 chaves falham mesmo sem estas mudanças (verificado desligando a mudança do rótulo).
Novos casos em `packages/render/src/plan/notes.text.test.ts`: seleção do texto (cor + caixa + alça), texto sem seleção,
`frame` (retângulo), `\n`/`width` (quebra preservada, bloco maior, `pre-wrap`), cota/texto da vista selecionados, hover
de texto e de cota, e o fallback para as anotações do nível.
