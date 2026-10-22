/** Alfabeto do IfcGloballyUniqueId (ISO 10303-21 / IFC): 64 símbolos, índice = valor do sexteto. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Hash de 32 bits (FNV-1a com semente e finalizador de avalanche); a semente gera 4 palavras independentes. */
function hash32(key: string, salt: number): number {
  let h = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * GlobalId de 22 caracteres derivado de forma determinística de `key` (o id do elemento no projeto, com o tipo, p.ex.
 * `wall:<id>`). Os 128 bits vêm de quatro hashes de 32 bits; o primeiro caractere leva os 2 bits de cima e cada um dos
 * outros 21 leva 6 bits, como manda o IfcGloballyUniqueId. O mesmo `key` sempre dá o mesmo GlobalId.
 */
export function ifcGuid(key: string): string {
  let n = 0n;
  for (let salt = 0; salt < 4; salt++) n = (n << 32n) | BigInt(hash32(key, salt));
  let out = ALPHABET[Number(n >> 126n)] ?? '0';
  for (let shift = 120; shift >= 0; shift -= 6) out += ALPHABET[Number((n >> BigInt(shift)) & 63n)] ?? '0';
  return out;
}
