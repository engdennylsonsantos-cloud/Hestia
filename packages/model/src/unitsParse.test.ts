import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits, type Quantity, type ResolvedUnits } from './units.ts';
import { formatQuantity } from './unitsFormat.ts';
import { parseQuantity } from './unitsParse.ts';

const u = defaultUnits();
const cm = resolveUnits({ length: { unit: 'cm', decimals: 2 }, smallLength: { unit: 'cm', decimals: 2 } });
const ftIn = resolveUnits({ length: { unit: 'ft-in', decimals: 2 } });
const pés = resolveUnits({ length: { unit: 'ft', decimals: 2 } });

const DEG = Math.PI / 180;

describe('parseQuantity — tabela de entradas', () => {
  const casos: Array<[string, Quantity, ResolvedUnits, number | null]> = [
    ['1,20', 'length', u, 1.2],
    ['1.2', 'length', u, 1.2],
    ['.5m', 'length', u, 0.5],
    ['-1,5', 'length', u, -1.5],
    ['+2m', 'length', u, 2],
    ['120cm', 'length', u, 1.2],
    ['1.2 m', 'length', u, 1.2],
    ['1200mm', 'length', u, 1.2],
    ['3,5ft', 'length', u, 1.0668],
    ['10in', 'length', u, 0.254],
    ['120', 'length', cm, 1.2],
    ['15mm', 'smallLength', u, 0.015],
    ["5'", 'length', u, 1.524],
    [`5'6"`, 'length', u, 1.6764],
    [`5' 6 1/2"`, 'length', u, 1.6891],
    [`1/2"`, 'length', u, 0.0127],
    [`0"`, 'length', u, 0],
    [`-5' 6"`, 'length', u, -1.6764],
    ['5-6', 'length', ftIn, 1.6764],
    ['5-6', 'length', pés, 1.6764],
    ['5-6', 'length', u, null],
    ['12', 'area', u, 12],
    ['12m2', 'area', u, 12],
    ['12m²', 'area', u, 12],
    ['1200cm2', 'area', u, 0.12],
    ['1200cm²', 'area', u, 0.12],
    ['5ft2', 'area', u, 0.4645152],
    ['2m3', 'volume', u, 2],
    ['2m³', 'volume', u, 2],
    ['500l', 'volume', u, 0.5],
    ['500L', 'volume', u, 0.5],
    ['2ft3', 'volume', u, 0.056633693184],
    ['45', 'angle', u, 45 * DEG],
    ['45°', 'angle', u, 45 * DEG],
    ['45deg', 'angle', u, 45 * DEG],
    ['0.78rad', 'angle', u, 0.78],
    ['5%', 'slope', u, 0.05],
    ['3deg', 'slope', u, Math.tan(3 * DEG)],
    ['3°', 'slope', u, Math.tan(3 * DEG)],
    ['0,5', 'slope', u, 0.005],
    ['2,5%', 'slope', u, 0.025],
    ['R$ 1250,00', 'currency', u, 1250],
    ['1250,50', 'currency', u, 1250.5],
    ['USD -3,50', 'currency', resolveUnits({ currency: 'USD' }), -3.5],
    ['', 'length', u, null],
    ['   ', 'length', u, null],
    ['NaN', 'length', u, null],
    ['abc', 'length', u, null],
    ['1,2,3', 'length', u, null],
    ['1/2', 'length', u, null],
    ['12cm2', 'length', u, null],
    ['5%', 'length', u, null],
    ['1 m2', 'length', u, null],
    ['12cm', 'area', u, null],
    ['R$ abc', 'currency', u, null],
    ['12"', 'area', u, null],
  ];

  it.each(casos)('%s (%s)', (texto, grandeza, unidades, esperado) => {
    const valor = parseQuantity(unidades, grandeza, texto);
    if (esperado === null) expect(valor).toBeNull();
    else expect(valor).toBeCloseTo(esperado, 9);
  });
});

describe('parseQuantity — ida e volta com formatQuantity', () => {
  function unidadesDe(patch: Parameters<typeof resolveUnits>[0]): ResolvedUnits {
    return resolveUnits(patch);
  }

  const casos: Array<[Quantity, Array<[string, number[]]>]> = [
    [
      'length',
      [
        ['m', [0, 0.0127, 1.6764, 3.5, -0.25]],
        ['cm', [0, 1.2, 167.64, -25]],
        ['mm', [0, 12.7, 1676.4]],
        ['ft', [0, 1.2, 5.5]],
        ['in', [0, 0.5, 66]],
        ['ft-in', [0, 0.0127, 1.6764, 1.6891, -1.6764]],
      ],
    ],
    [
      'area',
      [
        ['m2', [0, 0.5, 12.345]],
        ['cm2', [0, 5000, 1234.5]],
        ['ft2', [0, 1.5, 12]],
      ],
    ],
    [
      'volume',
      [
        ['m3', [0, 0.001, 1.5]],
        ['l', [0, 1, 1500]],
        ['ft3', [0, 1.5, 12]],
      ],
    ],
    [
      'angle',
      [
        ['deg', [0, 0.5, -1.2]],
        ['rad', [0, 0.5, -1.2]],
      ],
    ],
    [
      'slope',
      [
        ['percent', [-0.5, 0, 0.025, 1]],
        ['deg', [-0.5, 0, 0.025, 1]],
      ],
    ],
  ];

  it.each(casos)('%s em todas as unidades', (grandeza, porUnidade) => {
    for (const [unidade, valores] of porUnidade) {
      for (const v of valores) {
        const patch = {
          [grandeza]: { unit: unidade, decimals: 4 },
        } as Parameters<typeof resolveUnits>[0];
        const un = unidadesDe(patch);
        const texto = formatQuantity(un, grandeza, v);
        const voltou = parseQuantity(un, grandeza, texto);
        expect(voltou, `${grandeza} ${unidade}: ${texto}`).not.toBeNull();
        const tolerancia = unidade === 'ft-in' ? 2 : 4;
        expect(voltou, `${grandeza} ${unidade}: ${texto}`).toBeCloseTo(v, tolerancia);
      }
    }
  });

  it('moeda', () => {
    for (const v of [0, 1250.5, -3]) {
      const texto = formatQuantity(u, 'currency', v);
      expect(parseQuantity(u, 'currency', texto)).toBeCloseTo(v, 2);
    }
  });
});
