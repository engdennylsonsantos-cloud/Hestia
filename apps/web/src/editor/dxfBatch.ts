import { levelGraphicsOf, sectionGraphicsOf, sectionTitleOf, type Id, type Project } from '@hestia/model';
import type { DxfBatchFile, DxfBatchOptions, DxfBatchRenderers, DxfBatchResult, DxfBatchSkip, DxfBatchTarget } from './dxfBatch.types.ts';

/**
 * Lote de exportação DXF (fase 4): a lista de documentos do projeto, o nome de cada arquivo, o manifest e o pacote que o
 * diálogo transforma em ZIP. Funções puras, sem React: os renderizadores entram por parâmetro (a prancha vem do compositor
 * da folha, que não é acoplado aqui).
 */

/** Nome de arquivo seguro: sem acento (NFD), espaço e demais caracteres viram '-', sobra só [A-Za-z0-9._-]. */
export function dxfSanitizeName(text: string): string {
  const limpo = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/^-+|-+$/g, '');
  return limpo || 'sem-nome';
}

/** Documentos exportáveis do projeto, na ordem do diálogo: plantas, áreas, cortes/elevações e pranchas. */
export function dxfBatchTargetsOf(p: Project): DxfBatchTarget[] {
  return [
    ...p.levels.map((l): DxfBatchTarget => ({ kind: 'plan', key: `plan:${l.id}`, levelId: l.id, label: l.name, group: 'plantas' })),
    ...(p.areaPlans ?? []).map((a): DxfBatchTarget => ({ kind: 'area', key: `area:${a.id}`, planId: a.id, label: a.name, group: 'areas' })),
    ...p.views.map(
      (v): DxfBatchTarget => ({ kind: 'section', key: `section:${v.id}`, viewId: v.id, label: sectionTitleOf(v), group: 'cortes', elevation: v.kind === 'elevation' }),
    ),
    ...(p.sheets ?? []).map((s): DxfBatchTarget => ({ kind: 'sheet', key: `sheet:${s.id}`, sheetId: s.id, label: `${s.number} ${s.name}`, group: 'pranchas' })),
  ];
}

/** Data local no formato AAAA-MM-DD. */
function dataLocal(d: Date): string {
  const aaaa = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${aaaa}-${mm}-${dd}`;
}

/** Nome do ZIP do lote: `<prefixo>-DXF-AAAA-MM-DD.zip`, com o prefixo sanitizado e a data local. */
export function dxfBatchZipName(p: Project, date: Date = new Date(), prefix = p.name): string {
  const nome = prefix.trim() || p.name.trim() || 'projeto';
  return `${dxfSanitizeName(nome)}-DXF-${dataLocal(date)}.zip`;
}

/** Pasta de cada alvo no ZIP (elevação vai em ELEVACOES/). */
function pastaOf(t: DxfBatchTarget): string {
  if (t.kind === 'plan') return 'PLANTAS/';
  if (t.kind === 'area') return 'AREAS/';
  if (t.kind === 'section') return t.elevation ? 'ELEVACOES/' : 'CORTES/';
  return 'PRANCHAS/';
}

/** Tipo do documento, como sai no nome do arquivo e no manifest. */
function tipoOf(t: DxfBatchTarget): string {
  if (t.kind === 'plan') return 'PLANTA';
  if (t.kind === 'area') return 'AREA';
  if (t.kind === 'section') return t.elevation ? 'ELEVACAO' : 'CORTE';
  return 'PRANCHA';
}

/** Nome do nível de um id, ou vazio. */
function nivelDe(p: Project, levelId: Id): string {
  return p.levels.find((l) => l.id === levelId)?.name ?? '';
}

/** Nome da planta de área, ou undefined. */
function areaPlanDe(p: Project, planId: Id) {
  return (p.areaPlans ?? []).find((a) => a.id === planId);
}

/** Valores dos tokens do modelo de nome. */
function tokensOf(p: Project, t: DxfBatchTarget, options: DxfBatchOptions): Record<string, string> {
  const projeto = options.prefix.trim() || p.name;
  if (t.kind === 'plan') return { projeto, tipo: 'PLANTA', nome: t.label, nivel: t.label, prancha: '' };
  if (t.kind === 'area') {
    const plan = areaPlanDe(p, t.planId);
    return { projeto, tipo: 'AREA', nome: t.label, nivel: plan ? nivelDe(p, plan.levelId) : '', prancha: '' };
  }
  if (t.kind === 'section') return { projeto, tipo: t.elevation ? 'ELEVACAO' : 'CORTE', nome: t.label, nivel: '', prancha: '' };
  // O nome da prancha já leva o número: o modelo padrão (`{tipo}-{nome}`) não perde a identificação da folha.
  return { projeto, tipo: 'PRANCHA', nome: t.label, nivel: '', prancha: t.label };
}

/** Aplica o modelo de nome (tokens `{projeto}`, `{tipo}`, `{nome}`, `{nivel}`, `{prancha}`) e sanitiza o resultado. */
function nomeDe(p: Project, t: DxfBatchTarget, options: DxfBatchOptions): string {
  const modelo = options.pattern.trim() || '{tipo}-{nome}';
  const tokens = tokensOf(p, t, options);
  const bruto = modelo.replace(/\{(projeto|tipo|nome|nivel|prancha)\}/g, (_, token: string) => tokens[token] ?? '');
  return dxfSanitizeName(bruto);
}

/** Escala de papel do alvo, no formato `1:<denominador>`; prancha fica vazia (a escala é da folha). */
function escalaDe(p: Project, t: DxfBatchTarget): string {
  if (t.kind === 'plan') return `1:${levelGraphicsOf(p, t.levelId).scale}`;
  if (t.kind === 'area') {
    const plan = areaPlanDe(p, t.planId);
    return plan ? `1:${plan.scale}` : '';
  }
  if (t.kind === 'section') return `1:${sectionGraphicsOf(p).scale}`;
  return '';
}

/** Nível do alvo no manifest (corte/elevação e prancha não têm nível natural). */
function nivelDoAlvo(p: Project, t: DxfBatchTarget): string {
  if (t.kind === 'plan') return t.label;
  if (t.kind === 'area') {
    const plan = areaPlanDe(p, t.planId);
    return plan ? nivelDe(p, plan.levelId) : '';
  }
  return '';
}

/** Caminho livre dentro da pasta: colisão ganha `-2`, `-3`… antes de `.dxf`. */
function caminhoLivre(pasta: string, nome: string, usados: Set<string>): string {
  for (let n = 1; ; n++) {
    const caminho = `${pasta}${nome}${n === 1 ? '' : `-${n}`}.dxf`;
    if (!usados.has(caminho.toLowerCase())) {
      usados.add(caminho.toLowerCase());
      return caminho;
    }
  }
}

/** Campo do CSV: com `;`, aspas ou quebra de linha, sai entre aspas (aspas dobradas). */
function campoCsv(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Texto do LEIA-ME: formato, unidade, data, contagem e a ressalva das pranchas. */
function leiaMeDe(options: DxfBatchOptions, contagem: number): string {
  return [
    'Hestia - exportação DXF em lote',
    'Versão do formato: R2000 (AC1015)',
    `Unidade: ${options.units}`,
    `Data: ${dataLocal(new Date())}`,
    `Arquivos DXF: ${contagem}`,
    '',
    'As pranchas saem como plotadas (o mesmo desenho do PDF), com as vistas na escala da folha.',
    '',
  ].join('\r\n');
}

/** Renderiza um alvo pelo renderizador do tipo. Lança se o renderizador lançar. */
function renderizar(p: Project, t: DxfBatchTarget, options: DxfBatchOptions, renderers: DxfBatchRenderers): string {
  if (t.kind === 'plan') return renderers.plan(p, t.levelId, options);
  if (t.kind === 'area') return renderers.area(p, t.planId, options);
  if (t.kind === 'section') return renderers.section(p, t.viewId, options);
  const sheet = renderers.sheet;
  if (!sheet) throw new Error('prancha sem renderizador');
  return sheet(p, t.sheetId, options);
}

/**
 * Monta o lote dos alvos marcados, na ordem de `dxfBatchTargetsOf`: um DXF por alvo (com a pasta do grupo e o nome do
 * modelo), o `manifest.csv` e o `LEIA-ME.txt`. Alvo que falha não derruba o lote: entra em `skipped` com o motivo.
 */
export function buildDxfBatch(p: Project, selected: readonly string[], options: DxfBatchOptions, renderers: DxfBatchRenderers): DxfBatchResult {
  const alvos = dxfBatchTargetsOf(p);
  const porKey = new Map(alvos.map((t) => [t.key, t]));
  const marcados = new Set(selected);
  const skipped: DxfBatchSkip[] = [];

  // Alvo marcado que não existe mais no projeto (documento apagado com o diálogo aberto).
  for (const key of selected) {
    if (!porKey.has(key)) skipped.push({ key, label: key, reason: 'alvo inexistente' });
  }

  const files: DxfBatchFile[] = [];
  const linhas: string[] = [];
  const usados = new Set<string>();

  for (const t of alvos) {
    if (!marcados.has(t.key)) continue;
    if (t.kind === 'sheet' && !renderers.sheet) {
      skipped.push({ key: t.key, label: t.label, reason: 'prancha sem renderizador' });
      continue;
    }
    let data: string;
    try {
      data = renderizar(p, t, options, renderers);
    } catch (erro) {
      skipped.push({ key: t.key, label: t.label, reason: erro instanceof Error ? erro.message : String(erro) });
      continue;
    }
    const caminho = caminhoLivre(pastaOf(t), nomeDe(p, t, options), usados);
    files.push({ path: caminho, data });
    const prancha = t.kind === 'sheet' ? t.label : '';
    linhas.push([caminho, tipoOf(t), t.label, nivelDoAlvo(p, t), escalaDe(p, t), prancha].map(campoCsv).join(';'));
  }

  const manifest = ['arquivo;tipo;nome;nivel;escala;prancha', ...linhas].join('\r\n') + '\r\n';
  files.push({ path: 'manifest.csv', data: manifest });
  files.push({ path: 'LEIA-ME.txt', data: leiaMeDe(options, linhas.length) });

  return { files, manifest, skipped, zipName: dxfBatchZipName(p, new Date(), options.prefix) };
}
