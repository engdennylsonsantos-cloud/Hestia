import { useMemo, type ReactElement } from 'react';
import { formatRampSlope, rampNormRowFor, type RampType } from '@hestia/model';
import { fmtNum, useI18n } from '../../editor/i18n.ts';
import { SchematicViews, type SchematicView } from '../schematic/SchematicDrawing.tsx';
import { buildRampSectionDrawing } from './rampSectionDrawing.ts';

const TEXT = {
  pt: {
    tabs: 'Prévia da rampa',
    section: 'Corte',
    plan: 'Planta',
    empty: 'Preencha a inclinação para ver o desenho.',
    sectionAria: 'Corte da rampa: inclinação {slope}, desnível por lance até {rise} m, espessura {e} cm',
    planAria: 'Planta esquemática da rampa em U, largura {w} m',
  },
  en: {
    tabs: 'Ramp preview',
    section: 'Section',
    plan: 'Plan',
    empty: 'Fill in the slope to see the drawing.',
    sectionAria: 'Ramp section: slope {slope}, rise per flight up to {rise} m, thickness {e} cm',
    planAria: 'Schematic U-shaped ramp plan, width {w} m',
  },
} as const;

const fill = (s: string, params: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');

/** Prévia técnica da rampa: corte com cotas e triângulo de inclinação, e planta esquemática em U. */
export function RampSectionPreview({ type }: { type: RampType }): ReactElement {
  const lang = useI18n((s) => s.lang);
  const txt = TEXT[lang];
  const views = useMemo(() => {
    const fmt = (n: number, dec: number): string => fmtNum(n, dec, lang);
    try {
      const section = buildRampSectionDrawing(type, { view: 'section', lang, fmt });
      const plan = buildRampSectionDrawing(type, { view: 'plan', lang, fmt });
      const slope = type.defaultSlope;
      const row = rampNormRowFor(type, slope);
      const slopeTxtRaw = formatRampSlope(slope);
      const slopeTxt = lang === 'en' ? slopeTxtRaw.replace(/,/g, '.') : slopeTxtRaw;
      const riseValue = row?.maxRise ?? (type.normTable.length > 0 ? type.normTable[type.normTable.length - 1]!.maxRise : slope);
      return [
        {
          id: 'section',
          label: txt.section,
          drawing: section,
          ariaLabel: fill(txt.sectionAria, { slope: slopeTxt, rise: fmt(riseValue, 2), e: fmt(type.structuralDepth * 100, 1) }),
        },
        {
          id: 'plan',
          label: txt.plan,
          drawing: plan,
          ariaLabel: fill(txt.planAria, { w: fmt(type.defaultWidth, 2) }),
        },
      ] satisfies SchematicView[];
    } catch {
      return null;
    }
  }, [type, lang, txt]);
  if (!views) return <p className="stt-preview-empty">{txt.empty}</p>;
  return <SchematicViews tabsLabel={txt.tabs} views={views} />;
}
