import type { ReactElement } from 'react';
import { DEFAULT_ROOM_CATEGORIES, newId, type Project, type RoomCategory } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { Dialog } from './Dialog.tsx';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
const HATCHES: Array<NonNullable<RoomCategory['hatch']>> = ['diagonal', 'cross', 'dots', 'solid', 'none'];

/** Categorias de ambiente: nome, código, cor e hachura. As cores alimentam o esquema "Por categoria". */
export function RoomCategoriesDialog(): ReactElement {
  const p: Project = useProject();
  const cats = p.roomCategories ?? DEFAULT_ROOM_CATEGORIES;
  const update = (c: RoomCategory, patch: Partial<RoomCategory>): void => {
    editor.store.exec({ type: 'upsertRoomCategory', category: { ...c, ...patch } }, 'Editar categoria de ambiente');
  };
  const add = (): void => {
    editor.store.exec({ type: 'upsertRoomCategory', category: { id: newId('rc'), name: 'Nova categoria', code: '', color: '#dbe7f3', hatch: 'diagonal' } }, 'Criar categoria de ambiente');
  };
  const remove = (c: RoomCategory): void => {
    try {
      editor.store.exec({ type: 'removeRoomCategory', id: c.id }, 'Excluir categoria de ambiente');
    } catch (e) {
      useUi.setState({ status: e instanceof Error ? e.message : 'Não foi possível excluir a categoria.' });
    }
  };
  return (
    <Dialog
      title="Categorias de ambiente"
      sub="Nome, código, cor e hachura; a cor entra na planta de área quando o esquema é Por categoria"
      size="mid"
      onClose={close}
      footer={<><button className="btn small" onClick={add}>Nova categoria</button><span style={{ flex: 1 }} /><button className="btn primary" onClick={close}>Fechar</button></>}
    >
      <table className="tbl">
        <thead>
          <tr><th>Cor</th><th>Nome</th><th>Código</th><th>Hachura</th><th /></tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c.id}>
              <td><input type="color" aria-label={`Cor de ${c.name}`} value={c.color} onChange={(e) => update(c, { color: e.target.value })} /></td>
              <td><input className="input" aria-label={`Nome de ${c.name}`} value={c.name} onChange={(e) => update(c, { name: e.target.value })} /></td>
              <td><input className="input" aria-label={`Código de ${c.name}`} value={c.code ?? ''} onChange={(e) => update(c, { code: e.target.value })} style={{ width: 70 }} /></td>
              <td>
                <select className="select" aria-label={`Hachura de ${c.name}`} value={c.hatch ?? 'none'} onChange={(e) => update(c, { hatch: e.target.value as RoomCategory['hatch'] })}>
                  {HATCHES.map((h) => <option key={h} value={h}>{h === 'none' ? 'Sem hachura' : h === 'diagonal' ? 'Diagonal' : h === 'cross' ? 'Cruzada' : h === 'dots' ? 'Pontilhada' : 'Cheia'}</option>)}
                </select>
              </td>
              <td><button className="btn small" onClick={() => remove(c)} title="Excluir categoria">Excluir</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hint">Excluir uma categoria em uso é recusado. A cor da categoria também aparece na legenda e no IFC.</div>
    </Dialog>
  );
}
