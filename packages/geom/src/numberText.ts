/**
 * Número para formato de máquina (coordenada SVG/DXF/IFC): ponto decimal, sem zeros inúteis e sem `-0`.
 * Não use para texto de interface — medidas do projeto passam por `formatQuantity`.
 */
export function machineNumber(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '0';
  const casas = Math.min(10, Math.max(0, Math.trunc(digits)));
  const fator = 10 ** casas;
  const arredondado = Math.round(v * fator + Number.EPSILON * Math.abs(v * fator)) / fator;
  if (Object.is(arredondado, -0) || arredondado === 0) return '0';
  let texto = arredondado.toFixed(casas);
  if (texto.includes('.')) texto = texto.replace(/\.?0+$/, '');
  return texto;
}
