import {
  defaultUnits,
  formatQuantity,
  OPENING_FRAME_DEFAULTS,
  openingFamilyOf,
  openingLintel,
  spanTypeOf,
  type OpeningType,
} from '@hestia/model';

/**
 * Verificações do tipo de abertura mostradas no diálogo (faixa "Verificações"). São avisos de projeto, não regras do
 * modelo: nada aqui impede salvar o tipo. Largura livre e altura comparam o vão útil (menos o batente) com os mínimos
 * usuais; a ventilação é a área nominal do vão vezes a fração de abertura da família (NBR 10821, valores usuais).
 */
export interface OpeningCheck {
  level: 'ok' | 'warn';
  text: string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Fração da área nominal que conta como ventilação, por família de janela. */
function ventilationFactor(t: OpeningType): number | null {
  if (t.kind !== 'window') return null;
  switch (openingFamilyOf(t)?.id) {
    case 'window_fixed':
      return 0;
    case 'window_sliding':
      return 0.5;
    case 'window_casement':
      return 1;
    case 'window_tilt':
      return 0.8;
    case 'window_hinged':
      return 1;
    case 'window_hung':
      return 0.5;
    case 'window_pivot':
      return 0.9;
    case 'window_louver':
      return 0.7;
    case 'window_void':
      return 0;
    default:
      return 0;
  }
}

/** Largura livre de passagem: vão nominal menos as duas ombreiras do batente. */
export const openingClearWidth = (t: Pick<OpeningType, 'width' | 'frameWidth'>): number =>
  t.width - 2 * (t.frameWidth ?? OPENING_FRAME_DEFAULTS.frameWidth);

/** Altura livre: vão nominal menos a travessa superior do batente. */
export const openingClearHeight = (t: Pick<OpeningType, 'height' | 'frameWidth'>): number =>
  t.height - (t.frameWidth ?? OPENING_FRAME_DEFAULTS.frameWidth);

/** Área útil de ventilação (metros quadrados) da janela, pela fração da família; 0 para porta. */
export function openingVentilationArea(raw: OpeningType): number {
  const t = spanTypeOf(raw);
  const factor = ventilationFactor(t);
  return factor === null ? 0 : t.width * t.height * factor;
}

/**
 * Lista de verificações do tipo, na ordem: largura livre (NBR 9050), altura livre, ventilação (janela), profundidade
 * do batente contra o núcleo da parede e presença de verga. `coreThickness` é a espessura do núcleo (DEC-1).
 */
export function openingChecks(raw: OpeningType, coreThickness: number, units = defaultUnits()): OpeningCheck[] {
  const t = spanTypeOf(raw); // as larguras e alturas abaixo são do VÃO (com `nominalRef` 'leaf' a folha ganha a folga)
  const out: OpeningCheck[] = [];
  const freeW = openingClearWidth(t);
  out.push(
    freeW >= 0.8
      ? { level: 'ok', text: `Largura livre ${formatQuantity(units, 'length', freeW)} atende à NBR 9050 (mínimo ${formatQuantity(units, 'length', 0.8)}).` }
      : { level: 'warn', text: `Largura livre ${formatQuantity(units, 'length', freeW)} abaixo de ${formatQuantity(units, 'length', 0.8)} (NBR 9050, acessibilidade).` },
  );

  const freeH = openingClearHeight(t);
  out.push(
    freeH >= 2.1
      ? { level: 'ok', text: `Altura livre ${formatQuantity(units, 'length', freeH)} atende ao mínimo de ${formatQuantity(units, 'length', 2.1)}.` }
      : { level: 'warn', text: `Altura livre ${formatQuantity(units, 'length', freeH)} abaixo de ${formatQuantity(units, 'length', 2.1)}.` },
  );

  const factor = ventilationFactor(t);
  if (factor !== null) {
    const area = openingVentilationArea(t);
    if (factor === 0) {
      const nome = openingFamilyOf(t)?.id === 'window_void' ? 'Vão livre de janela' : 'Janela fixa';
      out.push({ level: 'warn', text: `${nome} não conta como ventilação (área útil ${formatQuantity(units, 'area', 0)}).` });
    } else {
      out.push({
        level: 'ok',
        text: `Área útil de ventilação ${formatQuantity(units, 'area', area)} (${pct(factor)} de ${formatQuantity(units, 'length', t.width)} × ${formatQuantity(units, 'length', t.height)}).`,
      });
    }
  }

  const core = typeof coreThickness === 'number' && Number.isFinite(coreThickness) ? Math.max(0, coreThickness) : 0;
  const depth = t.frameDepth ?? OPENING_FRAME_DEFAULTS.frameDepth;
  out.push(
    depth <= core
      ? { level: 'ok', text: `Profundidade do batente ${formatQuantity(units, 'length', depth)} cabe no núcleo de ${formatQuantity(units, 'length', core)}.` }
      : { level: 'warn', text: `Profundidade do batente ${formatQuantity(units, 'length', depth)} maior que o núcleo de ${formatQuantity(units, 'length', core)}.` },
  );

  out.push(
    openingLintel(t)
      ? { level: 'ok', text: 'Verga presente.' }
      : { level: 'warn', text: 'Verga ausente: o vão fica sem peça de concreto sobre a abertura.' },
  );

  return out;
}
