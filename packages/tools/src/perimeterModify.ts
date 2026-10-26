/**
 * Edição de linhas do esboço de perímetro (Aparar, Estender, Dividir, Deslocar, Espelhar, Rotacionar, Copiar, Matriz,
 * Alinhar, Excluir, Unir e Encaixar). Funções puras sobre `SketchDraft`: devolvem um rascunho novo, ou null quando a
 * operação é impossível (nada a fazer, linha inexistente, arco que não se sustenta). Ids e flags de telhado das linhas
 * tocadas são preservados.
 */
export { trimExtendToCorner, trimToBoundary, extendToBoundary, splitAt, splitBetween } from './perimeterModifyTrim.ts';
export { offsetSegs, offsetLoop } from './perimeterModifyOffset.ts';
export { mirrorSegs, rotateSegs, copySegs, arraySegs, alignSegToLine, deleteSegs } from './perimeterModifyTransform.ts';
export { joinLoose, snapEndsToCorners, JOIN_LIMIT } from './perimeterModifyJoin.ts';
