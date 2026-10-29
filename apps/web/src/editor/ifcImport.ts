import { importIfc, type ImportReport } from '@hestia/io';
import { editor } from './controller.ts';
import type { Lang } from './i18n.ts';

/**
 * Importação IFC pela interface (menu Arquivo → Importar IFC…). O importador do `@hestia/io` monta um projeto
 * novo; aqui ele entra no editor como um arquivo aberto, para as próximas edições e o Salvar valerem para o Hestia.
 */
export async function importIfcFile(file: File): Promise<{ name: string; report: ImportReport }> {
  const { project, report } = importIfc(await file.text());
  const name = nomeDoProjeto(file.name);
  editor.load(project, name);
  return { name, report };
}

/** "casa.ifc" vira "casa.hestia.json": o IFC original não é sobrescrito pelo Salvar. */
export function nomeDoProjeto(nome: string): string {
  const base = nome.trim().replace(/\.ifc$/i, '');
  return `${base || 'projeto'}.hestia.json`;
}

/** Resumo legível do relatório do importador, para a faixa do menu Arquivo e a barra de status. */
export interface ResumoImportacao {
  /** O que entrou, na ordem das categorias: "13 paredes, 5 portas, 11 janelas · 2 níveis". */
  texto: string;
  /** O que a v1 não representa, por classe IFC: "IFCSTAIR: 3". */
  ignorados: string[];
  /** Formas aproximadas e avisos do importador (o primeiro item pode resumir as aproximações). */
  avisos: string[];
}

/** Ordem das categorias do relatório no resumo (as chaves são as que o importador usa). */
const CATEGORIAS = ['paredes', 'portas', 'janelas', 'pisos', 'lajes', 'forros', 'ambientes', 'grades'] as const;

interface Nomes {
  readonly categorias: Readonly<Record<string, readonly [string, string]>>;
  readonly nivel: readonly [string, string];
  readonly nada: string;
  readonly aproximadas: string;
}

/** Singular e plural de cada categoria; o relatório só tem estas chaves, mas chaves novas caem no próprio nome. */
const NOMES: Record<Lang, Nomes> = {
  pt: {
    categorias: {
      paredes: ['parede', 'paredes'],
      portas: ['porta', 'portas'],
      janelas: ['janela', 'janelas'],
      pisos: ['piso', 'pisos'],
      lajes: ['laje', 'lajes'],
      forros: ['forro', 'forros'],
      ambientes: ['ambiente', 'ambientes'],
      grades: ['grade', 'grades'],
    },
    nivel: ['nível', 'níveis'],
    nada: 'Nenhum elemento reconhecido',
    aproximadas: 'Formas aproximadas',
  },
  en: {
    categorias: {
      paredes: ['wall', 'walls'],
      portas: ['door', 'doors'],
      janelas: ['window', 'windows'],
      pisos: ['floor', 'floors'],
      lajes: ['slab', 'slabs'],
      forros: ['ceiling', 'ceilings'],
      ambientes: ['room', 'rooms'],
      grades: ['grid', 'grids'],
    },
    nivel: ['level', 'levels'],
    nada: 'No recognizable elements',
    aproximadas: 'Approximate shapes',
  },
};

const contar = (n: number, nomes: readonly [string, string]): string => `${n} ${n === 1 ? nomes[0] : nomes[1]}`;

/** Contagens na ordem das categorias; chaves fora da lista entram depois, em ordem alfabética. */
function partesDe(contagem: Record<string, number>, L: Nomes): string[] {
  const conhecidas = CATEGORIAS.filter((c) => (contagem[c] ?? 0) > 0).map((c) => contar(contagem[c] ?? 0, L.categorias[c] ?? [c, c]));
  const extras = Object.entries(contagem)
    .filter(([c, n]) => n > 0 && !(CATEGORIAS as readonly string[]).includes(c))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, n]) => contar(n, [c, c]));
  return [...conhecidas, ...extras];
}

/** Resumo do relatório, sem tocar no DOM. `report.levels` já vem do importador (sempre ao menos 1). */
export function resumoImportacao(report: ImportReport, lang: Lang = 'pt'): ResumoImportacao {
  const L = NOMES[lang];
  const elementos = partesDe(report.imported, L);
  const niveis = report.levels > 0 ? contar(report.levels, L.nivel) : '';
  const texto = [elementos.length ? elementos.join(', ') : L.nada, niveis].filter(Boolean).join(' · ');
  const ignorados = Object.entries(report.skipped)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([classe, n]) => `${classe}: ${n}`);
  const aproximadas = partesDe(report.approximate, L);
  const avisos = [...(aproximadas.length ? [`${L.aproximadas}: ${aproximadas.join(', ')}`] : []), ...report.warnings];
  return { texto, ignorados, avisos };
}
