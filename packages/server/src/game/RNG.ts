import { randomBytes } from "crypto";

/**
 * Cryptographically secure Fisher-Yates shuffle
 * All RNG happens here on the server - never on client
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    // Use crypto.randomBytes for secure randomness
    const randomBuffer = randomBytes(4);
    const randomValue = randomBuffer.readUInt32BE(0);
    const j = randomValue % (i + 1);

    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Generate a random integer between min (inclusive) and max (exclusive)
 */
export function randomInt(min: number, max: number): number {
  const randomBuffer = randomBytes(4);
  const randomValue = randomBuffer.readUInt32BE(0);
  return min + (randomValue % (max - min));
}
