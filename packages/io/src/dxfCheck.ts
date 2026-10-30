/**
 * Verificador estrutural do DXF R2000 (AC1015) que o Hestia exporta. Não é um parser: confere o que o AutoCAD recusa ou lê
 * errado, para os testes pegarem antes do CAD (o AutoCAD descarta o desenho inteiro, "Invalid or incomplete DXF input").
 * Devolve a lista de problemas; vazia = estrutura válida.
 */

/** Seções na ordem do R2000. */
const SECTIONS = ['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS'];

/** Tabelas de símbolos que o escritor grava, na ordem (a LAYER é a que leva cor e espessura). */
const TABLES = ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD'];

/** Entidades que o Hestia emite. */
const ENTITIES = new Set(['POLYLINE', 'VERTEX', 'SEQEND', 'LINE', 'TEXT']);

/** Objetos do dicionário raiz que o escritor grava. */
const OBJECTS = new Set(['DICTIONARY', 'ACDBDICTIONARYWDFLT', 'ACDBPLACEHOLDER']);

/** Códigos de valor numérico (coordenadas, altura, ângulo, contagens); handles (5, 105, 330, 390) são hexa. */
const NUMERIC = new Set([10, 11, 20, 21, 30, 31, 40, 41, 42, 50, 62, 66, 70, 72, 73, 74, 90, 281, 290, 370]);

const HEX = /^[0-9A-F]+$/;

type Pair = [number, string];

/** Registros do arquivo agrupados pelo código 0. */
interface Record2000 {
  type: string;
  pairs: Pair[];
}

export function dxfProblems2000(text: string): string[] {
  const problems: string[] = [];
  if (!text.endsWith('\r\n')) problems.push('o arquivo não termina em CRLF');
  const lines = text.split('\r\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length % 2 !== 0) problems.push('número ímpar de linhas (par código/valor quebrado)');
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]);
    if (!Number.isInteger(code) || lines[i]!.trim() !== lines[i]) problems.push(`linha ${i + 1}: código de grupo inválido "${lines[i]}"`);
    pairs.push([code, lines[i + 1]!]);
  }

  const last = pairs.at(-1);
  if (!last || last[0] !== 0 || last[1] !== 'EOF') problems.push('o arquivo não termina em 0/EOF');
  if (pairs.filter(([c, v]) => c === 0 && v === 'EOF').length !== 1) problems.push('EOF ausente ou repetido');
  for (const [c, v] of pairs) {
    if (/[^\x20-\x7e]/.test(v)) problems.push(`valor não ASCII no código ${c} (o AC1015 lê em ANSI; use \\U+XXXX)`);
    if (c !== 1 && NUMERIC.has(c) && !Number.isFinite(Number(v))) problems.push(`valor não numérico no código ${c}: "${v}"`);
  }

  const version = pairs.findIndex(([c, v]) => c === 9 && v === '$ACADVER');
  if (version < 0 || pairs[version + 1]?.[1] !== 'AC1015') problems.push('$ACADVER ausente ou diferente de AC1015');

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

  // Registros: cada código 0 abre um; guardar o dono (330) e o handle (5 ou 105).
  const records: Record2000[] = [];
  for (const p of pairs) {
    if (p[0] === 0) records.push({ type: p[1], pairs: [] });
    else records.at(-1)?.pairs.push(p);
  }
  const field = (r: Record2000, code: number): string | undefined => r.pairs.find(([c]) => c === code)?.[1];
  const handleOf = (r: Record2000): string | undefined => field(r, 5) ?? field(r, 105);

  // Handles: únicos e abaixo do $HANDSEED.
  const seedPair = pairs[pairs.findIndex(([c, v]) => c === 9 && v === '$HANDSEED') + 1];
  const seed = seedPair ? parseInt(seedPair[1], 16) : NaN;
  if (!seedPair || !HEX.test(seedPair[1])) problems.push('$HANDSEED ausente ou inválido');
  const handles = new Map<string, Record2000>();
  for (const r of records) {
    if (r.type === 'SECTION' || r.type === 'ENDSEC') continue;
    const h = handleOf(r);
    if (h === undefined) continue;
    if (!HEX.test(h)) problems.push(`handle inválido "${h}" em ${r.type}`);
    if (handles.has(h)) problems.push(`handle repetido ${h} (${r.type})`);
    handles.set(h, r);
    if (Number.isFinite(seed) && parseInt(h, 16) >= seed) problems.push(`handle ${h} não é menor que $HANDSEED`);
  }

  // Tabelas: as nove do R2000, com a LAYER levando cor (62), tipo de linha válido (6), espessura (370) e plot style (390).
  const tableNames = records.filter((r) => r.type === 'TABLE').map((r) => field(r, 2) ?? '');
  if (tableNames.join(',') !== TABLES.join(',')) problems.push(`tabelas ${tableNames.join(',')} (esperado ${TABLES.join(',')})`);
  const ltypes = new Set(records.filter((r) => r.type === 'LTYPE').map((r) => field(r, 2)));
  for (const name of ['ByLayer', 'ByBlock', 'CONTINUOUS']) if (!ltypes.has(name)) problems.push(`tipo de linha ${name} ausente da tabela LTYPE`);
  const layers = records.filter((r) => r.type === 'LAYER');
  if (layers.length === 0) problems.push('tabela LAYER ausente ou vazia');
  for (const r of layers) {
    const name = field(r, 2) ?? '?';
    const lt = field(r, 6);
    if (lt === undefined) problems.push(`camada ${name} sem tipo de linha (6)`);
    else if (!ltypes.has(lt)) problems.push(`camada ${name} usa o tipo de linha ${lt}, que não está na tabela LTYPE`);
    if (field(r, 62) === undefined) problems.push(`camada ${name} sem cor (62)`);
    const weight = field(r, 370);
    if (weight === undefined) problems.push(`camada ${name} sem espessura (370)`);
    else if (!Number.isFinite(Number(weight))) problems.push(`camada ${name} com espessura inválida "${weight}"`);
    const plot = field(r, 390);
    if (plot === undefined) problems.push(`camada ${name} sem PlotStyleName (390)`);
    else if (!handles.has(plot)) problems.push(`camada ${name} aponta o 390 para o objeto ${plot}, que não existe`);
  }

  // BLOCKS: *Model_Space e *Paper_Space, donos das entidades.
  for (const name of ['*Model_Space', '*Paper_Space']) {
    if (!records.some((r) => r.type === 'BLOCK' && field(r, 2) === name)) problems.push(`BLOCK ${name} ausente`);
    if (!records.some((r) => r.type === 'BLOCK_RECORD' && field(r, 2) === name)) problems.push(`BLOCK_RECORD ${name} ausente`);
  }
  const modelSpace = records.find((r) => r.type === 'BLOCK_RECORD' && field(r, 2) === '*Model_Space');
  const modelHandle = modelSpace ? handleOf(modelSpace) : undefined;

  // ENTITIES: só as do escritor, todas com dono (330) no *Model_Space e handle próprio; POLYLINE → VERTEX… → SEQEND.
  let inEntities = false;
  let inPoly = false;
  let polyHandle = '';
  for (const r of records) {
    if (r.type === 'SECTION') {
      inEntities = field(r, 2) === 'ENTITIES';
      continue;
    }
    if (r.type === 'ENDSEC') {
      if (inEntities && inPoly) problems.push('POLYLINE sem SEQEND no fim');
      inEntities = false;
      continue;
    }
    if (!inEntities) continue;
    if (!ENTITIES.has(r.type)) {
      problems.push(`entidade ${r.type} fora da lista do escritor`);
      continue;
    }
    if (r.type === 'POLYLINE') {
      if (inPoly) problems.push('POLYLINE sem SEQEND');
      inPoly = true;
      polyHandle = handleOf(r) ?? '';
    } else if (r.type === 'VERTEX') {
      if (!inPoly) problems.push('VERTEX fora de uma POLYLINE');
      if (field(r, 330) !== modelHandle) problems.push('VERTEX sem dono no *Model_Space');
    } else if (r.type === 'SEQEND') {
      if (!inPoly) problems.push('SEQEND sem POLYLINE');
      if (field(r, 330) !== polyHandle) problems.push('SEQEND sem dono na POLYLINE');
      inPoly = false;
    } else if (inPoly) {
      problems.push(`${r.type} dentro de uma POLYLINE`);
    }
    if (r.type !== 'SEQEND' && r.type !== 'VERTEX' && field(r, 330) !== modelHandle) problems.push(`${r.type} sem dono no *Model_Space`);
  }

  // OBJECTS: só os objetos do escritor, e o dicionário raiz tem de existir.
  let inObjects = false;
  for (const r of records) {
    if (r.type === 'SECTION') {
      inObjects = field(r, 2) === 'OBJECTS';
      continue;
    }
    if (r.type === 'ENDSEC') {
      inObjects = false;
      continue;
    }
    if (inObjects && !OBJECTS.has(r.type)) problems.push(`objeto ${r.type} fora da lista do escritor`);
  }
  if (!records.some((r) => r.type === 'DICTIONARY' && field(r, 330) === '0')) problems.push('dicionário raiz (330 = 0) ausente');

  return [...new Set(problems)];
}
