import { buttCornerFinishPairs, isWall, type Command, type Id, type Project } from '@hestia/model';

export type SetJoinCommand = Extract<Command, { type: 'setJoin' }>;

/**
 * Comandos `setJoin` que trocam para esquadria as quinas em encosto com acabamento (aviso `wall-corner-butt-finish`).
 * `levelId` limita a um nível; `wallId` limita às quinas que tocam essa parede (botão "Corrigir" do aviso).
 * Sem argumentos, vale para o projeto todo. Idempotente: quinas já em esquadria não entram na lista.
 */
export function cornerMiterCommands(project: Project, levelId?: Id, wallId?: Id): SetJoinCommand[] {
  const walls = Object.values(project.elements).filter(isWall).filter((w) => levelId === undefined || w.levelId === levelId);
  return buttCornerFinishPairs(project, walls)
    .filter((pr) => wallId === undefined || pr.a.wallId === wallId || pr.b.wallId === wallId)
    .map((pr) => ({
      type: 'setJoin' as const,
      ends: [{ ...pr.a }, { ...pr.b }],
      config: { kind: 'miter' as const, flip: false },
    }));
}
