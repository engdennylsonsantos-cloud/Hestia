import { it } from 'vitest';
import { weightedSkeleton } from './skeleton.ts';
import { v2 } from './vec.ts';
it('p', () => {
  const sq = [v2(0,0),v2(12,0),v2(12,12),v2(0,12)];
  const r = weightedSkeleton({ outer: sq, holes: [[v2(4,4),v2(8,4),v2(8,8),v2(4,8)]], weights: [[0.3,0.3,0.3,0.3],[0.3,0.3,0.3,0.3]] });
  console.log('PR', r.ok, r.reason);
});
