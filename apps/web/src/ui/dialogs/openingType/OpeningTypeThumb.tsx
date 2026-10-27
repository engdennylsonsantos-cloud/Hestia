import { useMemo, type ReactElement } from 'react';
import type { OpeningType } from '@hestia/model';
import { previewMiniatureSvg } from './previewViews.ts';

/** Miniatura da elevação pelo mesmo caminho da prévia (projeto mínimo + seção), com cache por assinatura do tipo. */
export function OpeningTypeThumb({
  type,
  width = 96,
  height = 64,
}: {
  type: OpeningType;
  width?: number;
  height?: number;
}): ReactElement {
  const svg = useMemo(() => previewMiniatureSvg(type, width, height), [type, width, height]);
  return (
    <span
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
