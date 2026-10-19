import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, profileMean, splitProfile, profileHeightAt, totalThickness, type ProfilePoint } from '@hestia/model';
import { computeSection, quantifyLevel, resolveLevel } from './index.ts';

const GABLE: ProfilePoint[] = [{ t: 0, h: 2.8 }, { t: 3, h: 4.5 }, { t: 6, h: 2.8 }];
const STEP: ProfilePoint[] = [{ t: 0, h: 2.8 }, { t: 3, h: 2.8 }, { t: 3, h: 4 }, { t: 6, h: 4 }];

function wallWith(profile: ProfilePoint[] | null) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, topProfile: profile }) });
  return s;
}

describe('perfil superior', () => {
  it('altura em t: interpola, degrau pertence ao trecho seguinte, estende fora do intervalo', () => {
    expect(profileHeightAt(GABLE, 1.5)).toBeCloseTo(3.65);
    expect(profileHeightAt(STEP, 2.999)).toBeCloseTo(2.8);
    expect(profileHeightAt(STEP, 3)).toBeCloseTo(4);
    expect(profileHeightAt(GABLE, -1)).toBeCloseTo(2.8);
    expect(profileHeightAt(GABLE, 9)).toBeCloseTo(2.8);
    expect(profileMean(GABLE, 6)).toBeCloseTo(3.65);
    expect(profileMean(STEP, 6)).toBeCloseTo(3.4);
  });

  it.each([['empena', GABLE, 3.65], ['degrau', STEP, 3.4]] as const)('%s: volume = área × altura média e o corte longitudinal bate a integral', (_n, prof, mean) => {
    const s = wallWith([...prof]);
    const t = totalThickness(s.project.wallTypes.wt_alv14!);
    const q = quantifyLevel(s.project, resolveLevel(s.project, 'lv_0'));
    expect(q.walls[0]!.volume).toBeCloseTo(6 * t * mean, 3);
    const sec = computeSection(s.project, { a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, depth: 1 });
    expect(multiArea(sec.silhouette)).toBeCloseTo(6 * mean, 3);
    expect(sec.zMax).toBeCloseTo(prof === GABLE ? 4.5 : 4, 6);
  });

  it('sem perfil nada muda', () => {
    const a = quantifyLevel(wallWith(null).project, resolveLevel(wallWith(null).project, 'lv_0'));
    expect(a.walls[0]!.height).toBeCloseTo(2.8);
  });

  it('perfil abaixo de uma faixa (rodapé) remove a faixa onde o topo é mais baixo', () => {
    const s = wallWith([{ t: 0, h: 0.05 }, { t: 6, h: 0.05 }]);
    const q = quantifyLevel(s.project, resolveLevel(s.project, 'lv_0'));
    const t = totalThickness(s.project.wallTypes.wt_alv14!);
    expect(q.walls[0]!.volume).toBeCloseTo(6 * t * 0.05, 3);
  });

  it('dividir a parede divide o perfil sem mudar a forma', () => {
    const s = wallWith([...GABLE]);
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2 });
    const l = (s.project.elements.w as { topProfile: ProfilePoint[] }).topProfile;
    const r = (s.project.elements.w2 as { topProfile: ProfilePoint[] }).topProfile;
    expect(profileHeightAt(l, 2)).toBeCloseTo(profileHeightAt(GABLE, 2));
    expect(profileHeightAt(r, 0)).toBeCloseTo(profileHeightAt(GABLE, 2));
    expect(profileHeightAt(r, 1)).toBeCloseTo(profileHeightAt(GABLE, 3));
    expect(splitProfile(GABLE, 2)[1].at(-1)!.t).toBeCloseTo(4);
  });
});
