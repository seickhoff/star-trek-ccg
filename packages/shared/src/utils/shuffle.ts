/**
 * Configurable shuffle module.
 *
 * Default uses Math.random (suitable for client-side).
 * Server should call configureShuffle() at startup to inject
 * cryptographically secure randomness.
 */

type ShuffleFn = <T>(arr: readonly T[]) => T[];

/**
 * Default Fisher-Yates shuffle using Math.random
 */
function defaultShuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

let _shuffle: ShuffleFn = defaultShuffle;

/**
 * Replace the shuffle implementation.
 * Call this at app startup to inject crypto-secure randomness on the server.
 */
export function configureShuffle(fn: ShuffleFn): void {
  _shuffle = fn;
}

/**
 * Fisher-Yates shuffle (delegates to configured implementation)
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  return _shuffle(arr);
}

/**
 * Shuffle in place (mutates array)
 */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}
