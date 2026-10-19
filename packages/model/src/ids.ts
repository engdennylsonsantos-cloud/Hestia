let counter = 0;

/** ID estável e curto. Em testes pode ser fixado com `seedIds`. */
export function newId(prefix = 'e'): string {
  counter += 1;
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}${counter.toString(36)}`;
}

export function seedIds(start = 0): void {
  counter = start;
}
