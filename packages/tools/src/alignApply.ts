import { vizinhaCurta } from './alignNeighbors.ts';
import type { AlignSolution } from './alignSolve.ts';
import { transformWalls } from './edit.ts';
import { commitRingEdit } from './ringTarget.ts';
import type { ToolEnv } from './types.ts';

/** Ganchos para quem tem um esboço aberto (perímetro): aplica a linha alinhada no rascunho. */
export interface AlignApplyHooks {
  esboco?(sol: Extract<AlignSolution, { kind: 'esboco' }>): boolean;
}

export interface AlignApplied {
  applied: number;
  messages: string[];
}

/**
 * Aplica um resultado do Alinhar num único passo de desfazer (quem chama abre a transação). A parede usa o mesmo
 * `follow` do Alinhar antigo (a vizinha acompanha) e recusa quando uma vizinha ficaria com comprimento zero.
 */
export function applyAlign(env: ToolEnv, sol: AlignSolution, hooks: AlignApplyHooks = {}): boolean {
  if (sol.kind === 'nada' || sol.kind === 'erro') return false;

  if (sol.kind === 'transladar') {
    if (sol.target === 'parede') {
      const curta = vizinhaCurta(env.project(), env.levelId(), sol.id, sol.d);
      if (curta) {
        env.say(`Alinhar deixaria a parede ${curta.mark || curta.id} com comprimento zero: nada foi alterado.`);
        return false;
      }
      transformWalls(env, [sol.id], { kind: 'translate', d: sol.d }, 'Alinhar', true);
      return true;
    }
    env.exec({ type: 'transform', ids: [sol.id], transform: { kind: 'translate', d: sol.d } });
    return true;
  }

  if (sol.kind === 'ponta') {
    env.exec({ type: 'setWallEnds', id: sol.wallId, ...(sol.end === 'a' ? { a: sol.to } : { b: sol.to }) });
    return true;
  }

  if (sol.kind === 'abertura') {
    env.exec({ type: 'updateElements', ids: [sol.openingId], patch: { offset: sol.offset } });
    return true;
  }

  if (sol.kind === 'anel') {
    // Travada: commitRingEdit já diz o motivo na barra de status (Desvincular antes).
    return commitRingEdit(env, sol.ref, sol.ring);
  }

  if (sol.kind === 'esboco') {
    if (hooks.esboco) return hooks.esboco(sol);
    env.say('Linha do esboço: use o comando Alinhar do perímetro.');
    return false;
  }

  return false;
}

/**
 * Aplica vários resultados no mesmo passo de desfazer. Erros e "já alinhado" não entram na transação; as recusas
 * individuais (vizinha curta, anel travado) devolvem a mensagem em `messages`.
 */
export function applyAlignMany(env: ToolEnv, solutions: AlignSolution[], label = 'Alinhar', hooks: AlignApplyHooks = {}): AlignApplied {
  const valid = solutions.filter((s) => s.kind !== 'nada' && s.kind !== 'erro');
  if (!valid.length) return { applied: 0, messages: [] };
  let applied = 0;
  env.transaction(label, () => {
    for (const sol of valid) if (applyAlign(env, sol, hooks)) applied += 1;
  });
  return { applied, messages: [] };
}
