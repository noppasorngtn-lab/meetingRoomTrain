/** "Now", as one provider — so the rules that depend on it (BR-mrr-008 · BR-mrr-010) can be tested at a fixed time. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

/**
 * Milliseconds the app's clock runs ahead of the machine's. Always 0 unless the dev-only test
 * controls (modules/test-controls) move it — nothing else writes it.
 */
let offsetMs = 0;

export const clockOffsetMs = (): number => offsetMs;
export const setClockOffsetMs = (ms: number): void => {
  offsetMs = ms;
};

export const systemClock: Clock = { now: () => new Date(Date.now() + offsetMs) };
