/** "Now", as one provider — so the rules that depend on it (BR-mrr-008 · BR-mrr-010) can be tested at a fixed time. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
