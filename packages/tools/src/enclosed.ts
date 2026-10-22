// Reexport de compatibilidade: a lógica de circuito (`enclosedRooms`, `roomAt`, `outerPerimeter`) mudou para o motor
// (decisão 0023 §8.2a), onde o contorno associativo de piso e laje é derivado. Este arquivo mantém os nomes antigos.
export { enclosedRegionAt, enclosedRooms, outerPerimeter, roomAt, type RoomExtend } from '@hestia/engine';
