export type Random = () => number

/** PRNG deterministik supaya data mock tidak berubah setiap refresh. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function randomInt(min: number, max: number, random: Random): number {
  return Math.floor(random() * (max - min + 1)) + min
}

export function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)]
}
