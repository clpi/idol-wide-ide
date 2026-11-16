/**
 * Content hashing for state display.
 *
 * FNV-1a over 64 bits, computed on a canonical serialisation of the state.
 * Deterministic, dependency free, and good enough to make "this is a different
 * state" visible at a glance. Not a cryptographic digest, and the UI says so.
 */
export function fnv1a64(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i += 1) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/** Groups a 16 hex character hash into four readable quads. */
export function groupHash(hash: string): string {
  return hash.slice(0, 4) + ' ' + hash.slice(4, 8) + ' ' + hash.slice(8, 12) + ' ' + hash.slice(12, 16);
}

/** 8 character prefix, for chips and timeline rows. */
export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
