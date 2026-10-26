import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { PerimeterTool, addSegs, newDraft, type NewSeg } from '@hestia/tools';
import { editor } from './controller.ts';
import { perimeterActions } from './perimeter.ts';
import { DEFAULT_OPTIONS, useUi } from './state.ts';

/** Tecla como o App entrega ao controlador. */
const tecla = (key: string, ctrl = false): KeyboardEvent => ({ key, ctrlKey: ctrl, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

/** Clique de ponteiro em metros, com os modificadores de seleção. */
const clique = (x: number, y: number, mods: Partial<{ shift: boolean; ctrl: boolean }> = {}): { raw: { x: number; y: number }; shift: boolean; ctrl: boolean; alt: boolean } => ({
  raw: { x, y }, shift: mods.shift ?? false, ctrl: mods.ctrl ?? false, alt: false,
});

/** Retângulo (0,0)–(6,4), com uma linha por lado. */
const RETANGULO: NewSeg[] = [
  { a: { x: 0, y: 0 }, b: { x: 6, y: 0 } },
  { a: { x: 6, y: 0 }, b: { x: 6, y: 4 } },
  { a: { x: 6, y: 4 }, b: { x: 0, y: 4 } },
  { a: { x: 0, y: 4 }, b: { x: 0, y: 0 } },
];

const ferramenta = (): PerimeterTool => {
  const t = editor.activeTool;
  if (!(t instanceof PerimeterTool)) throw new Error('a ferramenta ativa não é o perímetro');
  return t;
};

/** Abre o modo do alvo e deixa o retângulo no rascunho, como se tivesse sido desenhado. */
const abrirComRetangulo = (target: 'roof' | 'floor' = 'floor'): void => {
  editor.setTool(target);
  ferramenta().loadDraft(addSegs(newDraft(target), RETANGULO));
  editor.setTool('select');
};

const selecionadas = (): string[] => editor.perimetro.view().draft?.selected ?? [];

const iniciar = (): void => {
  useUi.setState({ options: DEFAULT_OPTIONS });
  editor.load(createEmptyProject(), 'teste.hestia.json');
};

describe('Selecionar dentro do modo de perímetro', () => {
  beforeEach(iniciar);

  it('o botão Selecionar tira a forma e o comando, e a visão marca o estado de seleção', () => {
    abrirComRetangulo();
    const v = editor.perimetro.view();
    expect(v.active).toBe(true);
    expect(v.modify).toBeNull();
    expect(v.selecting).toBe(true);
    expect(v.shape).toBe('line');
    expect(editor.perimetro.selecionando).toBe(true);
  });

  it('clique numa linha seleciona, clique no vazio limpa e Shift soma', () => {
    abrirComRetangulo();
    const [inf, dir] = editor.perimetro.view().draft!.segs.map((s) => s.id);
    editor.pointer('click', clique(3, 0));
    expect(selecionadas()).toEqual([inf]);
    editor.pointer('click', clique(12, 12));
    expect(selecionadas()).toEqual([]);
    editor.pointer('click', clique(3, 0));
    editor.pointer('click', clique(6, 2, { shift: true }));
    expect(selecionadas()).toEqual([inf, dir]);
  });

  it('Ctrl+A seleciona todas as linhas do esboço, sem mexer na geometria nem no projeto', () => {
    abrirComRetangulo('roof');
    const antes = editor.project;
    const ids = editor.perimetro.view().draft!.segs.map((s) => s.id);
    expect(editor.key(tecla('a', true))).toBe(true);
    expect(new Set(selecionadas())).toEqual(new Set(ids));
    expect(editor.perimetro.view().draft!.segs).toHaveLength(4);
    expect(editor.project).toBe(antes);
    expect(useUi.getState().status).toContain('4 linha(s) selecionada(s)');
    expect(editor.perimetro.view().active).toBe(true);
    expect(editor.perimetro.view().selecting).toBe(true);
  });

  it('Ctrl+A sem linhas no esboço avisa e continua no modo', () => {
    editor.setTool('floor');
    editor.setTool('select');
    expect(editor.key(tecla('a', true))).toBe(true);
    expect(useUi.getState().status).toContain('Não há linhas');
    expect(editor.perimetro.view().active).toBe(true);
  });

  it('Esc com um comando de Modificar ligado volta ao Selecionar sem sair do modo', () => {
    abrirComRetangulo();
    perimeterActions.setModify('move');
    expect(editor.perimetro.view().modify).toBe('move');
    expect(editor.perimetro.view().selecting).toBe(false);
    expect(editor.key(tecla('Escape'))).toBe(true);
    const v = editor.perimetro.view();
    expect(v.active).toBe(true);
    expect(v.modify).toBeNull();
    expect(v.selecting).toBe(true);
  });

  it('Esc tira a forma escolhida e deixa o Selecionar ativo', () => {
    abrirComRetangulo();
    perimeterActions.setShape('rect');
    expect(editor.perimetro.view().selecting).toBe(false);
    expect(editor.key(tecla('Escape'))).toBe(true);
    const v = editor.perimetro.view();
    expect(v.active).toBe(true);
    expect(v.selecting).toBe(true);
    expect(editor.perimetro.selecionando).toBe(true);
  });

  it('Selecionar e Esc saem da seta de inclinação e voltam a escolher linhas (telhado)', () => {
    abrirComRetangulo('roof');
    perimeterActions.setLineKind('slope');
    expect(editor.perimetro.view().lineKind).toBe('slope');
    editor.setTool('select');
    expect(editor.perimetro.view().lineKind).toBe('boundary');
    expect(editor.perimetro.view().selecting).toBe(true);
    editor.pointer('click', clique(3, 0));
    expect(selecionadas()).toHaveLength(1);

    perimeterActions.setLineKind('slope');
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(editor.perimetro.view().lineKind).toBe('boundary');
    expect(editor.perimetro.view().selecting).toBe(true);
    expect(editor.perimetro.view().active).toBe(true);
  });

  it('Ctrl+A fora do modo não é consumido pelo perímetro', () => {
    expect(editor.perimetro.ativo).toBe(false);
    expect(editor.key(tecla('a', true))).toBe(false);
  });
});
