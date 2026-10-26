import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPENING_TYPES, openingFamilies, type OpeningType } from '@hestia/model';
import { openingChecks } from '@hestia/engine';
import { editor } from '../../../editor/controller.ts';
import { familyOptionsFor, leavesChoicesFor, openingVariants } from '../openingTypeForm.ts';
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
  });

  it('a biblioteca lista as famílias de porta com a contagem e as variantes', () => {
    const html = renderToStaticMarkup(
      createElement(OpeningTypeLibrary, {
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
  });

  it('a prévia mostra as abas (só a elevação habilitada) e a faixa de verificações', () => {
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
    expect(html).toContain('disabled');
    expect(html).toContain('Verificações');
    expect(html).toContain('Largura livre 0,80 m');
    expect(html).toContain('Altura livre 2,05 m');
    expect(html).toContain('Verga ausente');
    expect(html).toContain('Inverter dobradiça');
    expect(html).toContain('Inverter sentido');
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
