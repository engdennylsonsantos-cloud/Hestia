import { makeLevel, type Id, type Project } from '@hestia/model';
import { slug } from './elementTypes.ts';
import type { IfcFile } from './ifc.ts';
import type { StepEntity } from './step.ts';

/** Nível importado: id do Hestia, cota e id da entidade `IfcBuildingStorey` de origem. */
export interface LevelRef {
  id: Id;
  elevation: number;
  storey: number;
}

/** Cota de um pavimento: `Elevation` (atributo 9) ou a origem do placement. */
function storeyElevation(f: IfcFile, e: StepEntity): number {
  const explicit = f.num(e, 9);
  if (explicit != null) return explicit * f.units.length;
  return f.productPlacement(e).o.z;
}

/** Níveis do arquivo (do mais baixo para o mais alto); sem pavimentos, cria o Térreo em 0 m. */
export function readLevels(f: IfcFile, p: Project, report: { levels: number }): LevelRef[] {
  const storeys = f.byType('IFCBUILDINGSTOREY').map((e) => ({ e, z: storeyElevation(f, e) }));
  storeys.sort((a, b) => a.z - b.z);
  if (!storeys.length) {
    const level = makeLevel({ id: 'lv_0', name: 'Térreo', elevation: 0 });
    p.levels = [level];
    report.levels = 1;
    return [{ id: level.id, elevation: 0, storey: 0 }];
  }
  p.levels = storeys.map((s, i) => {
    const name = f.text(s.e, 2).trim() || `Nível ${i + 1}`;
    return makeLevel({ id: `lv_${i}_${slug(name) || i}`, name, elevation: s.z });
  });
  report.levels = p.levels.length;
  return storeys.map((s, i) => ({ id: p.levels[i]!.id, elevation: s.z, storey: s.e.id }));
}
