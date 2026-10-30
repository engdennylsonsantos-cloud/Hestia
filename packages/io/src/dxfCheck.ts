/**
 * Verificador estrutural do DXF R12 (AC1009) que o Hestia exporta. Não é um parser: confere o que o AutoCAD recusa ou lê
 * errado, para os testes pegarem antes do CAD (o AutoCAD descarta o desenho inteiro, "Invalid or incomplete DXF input").
 * Devolve a lista de problemas; vazia = estrutura válida.
 */

/** Códigos que só existem a partir do R13/R2000: no R12 o AutoCAD recusa o arquivo ("Unknown group 370 for table"). */
const CODES_AFTER_R12 = new Set([100, 102, 330, 360, 370, 390]);

/** Seções na ordem do formato clássico. */
const SECTIONS = ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'];

/** Entidades que o Hestia emite. */
const ENTITIES = new Set(['POLYLINE', 'VERTEX', 'SEQEND', 'LINE', 'TEXT']);

/** Códigos de valor numérico nas entidades (coordenadas, altura, ângulo). */
const NUMERIC = new Set([10, 11, 20, 21, 30, 31, 40, 41, 42, 50, 70]);

export function dxfProblemsR12(text: string): string[] {
  const problems: string[] = [];
  if (!text.endsWith('\r\n')) problems.push('o arquivo não termina em CRLF');
  const lines = text.split('\r\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length % 2 !== 0) problems.push('número ímpar de linhas (par código/valor quebrado)');
  const pairs: Array<[number, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]);
    if (!Number.isInteger(code) || lines[i]!.trim() !== lines[i]) problems.push(`linha ${i + 1}: código de grupo inválido "${lines[i]}"`);
    pairs.push([code, lines[i + 1]!]);
  }

  const last = pairs.at(-1);
  if (!last || last[0] !== 0 || last[1] !== 'EOF') problems.push('o arquivo não termina em 0/EOF');
  if (pairs.filter(([c, v]) => c === 0 && v === 'EOF').length !== 1) problems.push('EOF ausente ou repetido');
  for (const [c, v] of pairs) {
    if (CODES_AFTER_R12.has(c)) problems.push(`código ${c} não existe no R12`);
    if (/[^\x20-\x7e]/.test(v)) problems.push(`valor não ASCII no código ${c} (o R12 lê em ANSI; use \\U+XXXX)`);
    if (c !== 1 && NUMERIC.has(c) && !Number.isFinite(Number(v))) problems.push(`valor não numérico no código ${c}: "${v}"`);
  }

  const version = pairs.findIndex(([c, v]) => c === 9 && v === '$ACADVER');
  if (version < 0 || pairs[version + 1]?.[1] !== 'AC1009') problems.push('$ACADVER ausente ou diferente de AC1009');

  // Seções: ordem do formato e fechamento.
  const names: string[] = [];
  let open = false;
  pairs.forEach(([c, v], i) => {
    if (c === 0 && v === 'SECTION') {
      if (open) problems.push('SECTION dentro de outra seção');
      open = true;
      names.push(pairs[i + 1]?.[1] ?? '');
    } else if (c === 0 && v === 'ENDSEC') {
      if (!open) problems.push('ENDSEC sem SECTION');
      open = false;
    }
  });
  if (open) problems.push('seção sem ENDSEC');
  if (names.join(',') !== SECTIONS.join(',')) problems.push(`seções ${names.join(',')} (esperado ${SECTIONS.join(',')})`);

  // Tabelas: contagem da LAYER e tipos de linha referenciados.
  const tables = new Map<string, Array<Array<[number, string]>>>();
  let table = '';
  let record: Array<[number, string]> | null = null;
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i]!;
    if (c === 0 && v === 'TABLE') {
      table = pairs[i + 1]?.[1] ?? '';
      tables.set(table, []);
      record = null;
    } else if (c === 0 && v === 'ENDTAB') {
      table = '';
      record = null;
    } else if (table && c === 0) {
      record = [];
      tables.get(table)!.push(record);
    } else if (table && record) {
      record.push([c, v]);
    }
  }
  const field = (r: Array<[number, string]>, code: number): string | undefined => r.find(([c]) => c === code)?.[1];
  const ltypes = new Set((tables.get('LTYPE') ?? []).map((r) => field(r, 2)));
  const layers = tables.get('LAYER') ?? [];
  if (!tables.has('LAYER')) problems.push('tabela LAYER ausente');
  if (!tables.has('STYLE')) problems.push('tabela STYLE ausente');
  for (const r of layers) {
    const lt = field(r, 6);
    if (lt && !ltypes.has(lt)) problems.push(`camada ${field(r, 2)} usa o tipo de linha ${lt}, que não está na tabela LTYPE`);
  }

  // Entidades: só as do R12 e POLYLINE → VERTEX… → SEQEND.
  const start = pairs.findIndex(([c, v], i) => c === 2 && v === 'ENTITIES' && pairs[i - 1]?.[1] === 'SECTION');
  let inPoly = false;
  for (let i = start + 1; start >= 0 && i < pairs.length; i++) {
    const [c, v] = pairs[i]!;
    if (c !== 0) continue;
    if (v === 'ENDSEC') break;
    if (!ENTITIES.has(v)) problems.push(`entidade ${v} fora do R12 emitido`);
    if (v === 'POLYLINE') {
      if (inPoly) problems.push('POLYLINE sem SEQEND');
      inPoly = true;
    } else if (v === 'VERTEX' && !inPoly) problems.push('VERTEX fora de uma POLYLINE');
    else if (v === 'SEQEND') {
      if (!inPoly) problems.push('SEQEND sem POLYLINE');
      inPoly = false;
    } else if (inPoly && v !== 'VERTEX') problems.push(`${v} dentro de uma POLYLINE`);
  }
  if (inPoly) problems.push('POLYLINE sem SEQEND no fim');
  return [...new Set(problems)];
}
