import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPENING_TYPES, openingFamilies, openingFormFields, type OpeningFamilyId, type OpeningType } from '@hestia/model';
import { openingChecks } from '@hestia/engine';
import { editor } from '../../../editor/controller.ts';
import { familyOptionsFor, leavesChoicesFor, newOpeningTypeFromFamily, openingVariants } from '../openingTypeForm.ts';
import { OpeningTypeDialog } from './OpeningTypeDialog.tsx';
import { OpeningTypeHeader } from './OpeningTypeHeader.tsx';
import { OpeningTypeLibrary } from './OpeningTypeLibrary.tsx';
import { OpeningTypePreview } from './OpeningTypePreview.tsx';
import { OpeningTypeSections } from './OpeningTypeSections.tsx';

// O diálogo lê o projeto pelo controlador; no teste de render, um projeto vazio em memória basta (sem DOM).
vi.mock('../../../editor/controller.ts', async () => {
  const { ProjectStore, createEmptyProject } = await import('@hestia/model');
  const store = new ProjectStore(createEmptyProject());
  return { editor: { store }, useProject: () => store.project, useProjectVersion: () => store.version };
});

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;
const vazio = (): void => {};

describe('diálogo do tipo de abertura (render)', () => {
  it('renderiza o diálogo completo com biblioteca, sete seções e verificações', () => {
    const d = tipo('ot_p90');
    editor.store.exec({ type: 'upsertOpeningType', openingType: { ...d, id: 'ot_smoke', name: 'Porta de teste' } });
    const html = renderToStaticMarkup(createElement(OpeningTypeDialog, { typeId: 'ot_smoke' }));
    expect(html).toContain('Propriedades do tipo');
    expect(html).toContain('Porta de teste');
    expect(html).toContain('Biblioteca');
    expect((html.match(/class="pgroup op-sec/g) ?? []).length).toBe(7);
    expect(html).toContain('Verificações');
    expect(html).toContain('Inverter dobradiça');
    expect(html).toContain('+ Novo tipo');
    expect(html).toContain('Aplicar');
  });

  it('mostra as sete seções recolhíveis, com o nível de detalhe destacado', () => {
    const d = tipo('ot_p90');
    const family = openingFamilies('door').find((f) => f.id === 'door_swing')!;
    const html = renderToStaticMarkup(
      createElement(OpeningTypeSections, {
        d,
        onChange: vazio,
        families: openingFamilies('door'),
        family,
        leaves: leavesChoicesFor(family),
        materials: {},
      }),
    );
    expect((html.match(/class="pgroup op-sec/g) ?? []).length).toBe(7);
    for (const title of [
      'Pré-visualização e posicionamento',
      'Definições da folha',
      'Moldura e vidro',
      'Planta e corte',
      'Nível de detalhe',
      'Acabamento',
      'Identidade e dados BIM',
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain('pgroup op-sec hl');
    expect(html).toContain('id="ot-name"');
    expect(html).toContain('Resistência ao fogo');
    expect(html).not.toContain('Fator solar');
    // Estilo da folha (5) e maçaneta (4): cada escolha mostra a elevação em miniatura pelo mesmo caminho.
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('a biblioteca lista as famílias de porta com a contagem e as variantes', () => {
    const html = renderToStaticMarkup(
      createElement(OpeningTypeLibrary, {
        type: tipo('ot_p90'),
        families: openingFamilies('door'),
        familyId: 'door_swing',
        counts: { door_swing: 2, door_double: 1 },
        variants: openingVariants('door'),
        open: true,
        onToggle: vazio,
        onFamily: vazio,
        onVariant: vazio,
      }),
    );
    expect(html).toContain('Porta de giro');
    expect(html).toContain('Porta dupla');
    expect(html).toContain('Porta de correr');
    expect(html).toContain('>2<');
    expect(html).toContain('Lisa');
    expect(html).toContain('class="th"');
    expect(html).toContain('<svg');
    expect(html).toContain('data-op="stroke"');
  });

  it('a prévia habilita as cinco abas e mostra a faixa de verificações', () => {
    const d = tipo('ot_p90');
    const checks = openingChecks(d, 0.14);
    const html = renderToStaticMarkup(
      createElement(OpeningTypePreview, {
        d,
        tab: 'elevation',
        onTab: vazio,
        flipHand: false,
        flipFacing: false,
        onFlipHand: vazio,
        onFlipFacing: vazio,
        angle: 90,
        onAngle: vazio,
        checks,
      }),
    );
    expect(html).toContain('Planta');
    expect(html).toContain('Elevação');
    expect(html).toContain('Corte');
    expect(html).toContain('3D linhas');
    expect(html).toContain('3D sombreado');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Verificações');
    expect(html).toContain('Largura livre 0,80 m');
    expect(html).toContain('Altura livre 2,05 m');
    expect(html).toContain('Verga ausente');
    expect(html).toContain('Inverter dobradiça');
    expect(html).toContain('Inverter sentido');
  });

  it('sem WebGL (render em string), o 3D avisa e as outras abas continuam disponíveis', () => {
    const d = tipo('ot_p90');
    const html = renderToStaticMarkup(
      createElement(OpeningTypePreview, {
        d,
        tab: 'lines3d',
        onTab: vazio,
        flipHand: false,
        flipFacing: false,
        onFlipHand: vazio,
        onFlipFacing: vazio,
        angle: 90,
        onAngle: vazio,
        checks: [],
      }),
    );
    expect(html).toContain('3D indisponível neste navegador');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Planta');
    expect(html).toContain('Corte');
  });

  it('o cabeçalho oferece família, tipo, duplicar, renomear e favorito', () => {
    const html = renderToStaticMarkup(
      createElement(OpeningTypeHeader, {
        families: openingFamilies('door'),
        familyId: 'door_swing',
        types: [{ id: 'ot_p90', name: 'Porta 90 x 210' }],
        currentId: 'ot_p90',
        nameFieldId: 'ot-name',
        favorite: true,
        onFamily: vazio,
        onType: vazio,
        onDuplicate: vazio,
        onFavorite: vazio,
      }),
    );
    expect(html).toContain('Família:');
    expect(html).toContain('Tipo:');
    expect(html).toContain('Duplicar…');
    expect(html).toContain('Renomear…');
    expect(html).toContain('★');
    expect(html).toContain('Porta de giro');
  });

  it('o seletor de maçaneta mostra o valor efetivo: lever no ot_p90 e none quando o tipo grava none', () => {
    const family = openingFamilies('door').find((f) => f.id === 'door_swing')!;
    const render = (d: OpeningType): string =>
      renderToStaticMarkup(
        createElement(OpeningTypeSections, {
          d,
          onChange: vazio,
          families: openingFamilies('door'),
          family,
          leaves: leavesChoicesFor(family),
          materials: {},
        }),
      );
    const selectedValue = (html: string, id: string): string | null => {
      const start = html.indexOf(`id="${id}"`);
      const end = html.indexOf('</select>', start);
      const select = html.slice(start, end);
      const tag = select.split('<option').find((t) => t.includes('selected')) ?? '';
      return /value="([^"]+)"/.exec(tag)?.[1] ?? null;
    };
    const padrao = tipo('ot_p90');
    expect(padrao.handle).toBeUndefined();
    expect(selectedValue(render(padrao), 'op-handle')).toBe('lever');
    expect(selectedValue(render({ ...padrao, handle: 'none' }), 'op-handle')).toBe('none');
    // O estilo da folha, o batente e os detalhes também mostram o efetivo (não o campo vazio).
    expect(selectedValue(render(padrao), 'op-leaf')).toBe('flush');
    expect(selectedValue(render(padrao), 'op-frame')).toBe('rebate');
    expect(selectedValue(render(padrao), 'op-d2')).toBe('scale');
    expect(selectedValue(render(padrao), 'op-d3')).toBe('view');
  });

  it('o seletor de famílias do formulário só traz as portas', () => {
    expect(familyOptionsFor('door').map((f) => f.name)).toEqual([
      'Porta de giro',
      'Porta dupla',
      'Porta de correr',
      'Porta pivotante',
      'Porta vai-e-vem',
      'Porta de embutir',
      'Porta dobrável',
      'Porta sanfonada',
      'Portão seccionado',
      'Vão livre',
    ]);
  });
});

/** Rótulo principal de cada campo de opção (o teste confere presença/ausência pelo texto do `<label>`). */
const FIELD_LABEL: Record<string, string[]> = {
  leafStyle: ['Estilo da folha'],
  glassRatio: ['Fração de vidro'],
  handle: ['Maçaneta'],
  hinges: ['Dobradiças'],
  angle: ['Ângulo 2D', 'Ângulo 3D'],
  transom: ['Bandeira superior'],
  sidelights: ['Bandeira esquerda', 'Bandeira direita'],
  frame: ['Estilo do batente', 'Largura do perfil', 'Profundidade do batente'],
  reveal: ['Recuo', 'Âncora do recuo'],
  glassKind: ['Tipo de vidro'],
  grid: ['Divisões: colunas', 'Divisões: linhas'],
  tiltAxis: ['Eixo da basculante'],
  threshold: ['Soleira'],
  casing: ['Alizar'],
  sillBoard: ['Soleira saliente'],
  lintel: ['Verga'],
  sillBeam: ['Contraverga'],
};

describe('diálogo: campos visíveis por família', () => {
  const familia = (id: OpeningFamilyId): ReturnType<typeof openingFamilies>[number] =>
    openingFamilies(id.startsWith('door') ? 'door' : 'window').find((f) => f.id === id)!;

  const render = (id: OpeningFamilyId): string => {
    const family = familia(id);
    const d = newOpeningTypeFromFamily(family);
    return renderToStaticMarkup(
      createElement(OpeningTypeSections, {
        d,
        onChange: vazio,
        families: familyOptionsFor(d.kind),
        family,
        leaves: leavesChoicesFor(family),
        materials: {},
      }),
    );
  };

  for (const id of ['door_swing', 'door_sliding', 'window_fixed', 'window_tilt'] as const) {
    it(`${id}: mostra exatamente os campos de openingFormFields`, () => {
      const html = render(id);
      const visiveis = new Set<string>(openingFormFields(id));
      for (const [campo, rotulos] of Object.entries(FIELD_LABEL)) {
        for (const rotulo of rotulos) {
          const presente = html.includes(`>${rotulo}</label>`);
          expect(presente, `${id}: ${campo} (${rotulo})`).toBe(visiveis.has(campo));
        }
      }
    });
  }

  it('portão não mostra maçaneta, bandeira nem soleira; basculante mostra o eixo; veneziana não mostra grade', () => {
    const portao = render('door_garage');
    expect(portao.includes('>Maçaneta</label>')).toBe(false);
    expect(portao.includes('>Bandeira superior</label>')).toBe(false);
    expect(portao.includes('>Soleira</label>')).toBe(false);
    expect(render('window_tilt').includes('>Eixo da basculante</label>')).toBe(true);
    expect(render('window_louver').includes('>Divisões: colunas</label>')).toBe(false);
    expect(render('door_swing').includes('>Lambri (macho e fêmea)<')).toBe(true);
    expect(render('door_swing').includes('>Vidro total<')).toBe(true);
  });
});
