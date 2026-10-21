// @vitest-environment node
// Reads source files and vite.config — no DOM; esbuild (pulled in by the config) refuses to load under jsdom.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { API_PREFIXES } from '../../vite.config';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Every source file outside the tests — the pages are what decide which api paths get called. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

/** The first path segment of every getJson / postJson / patchJson call, e.g. "/auth" for '/auth/me'. */
const calledPrefixes = (): string[] => {
  const call = /\b(?:getJson|postJson|patchJson)\s*(?:<[^()]*?>)?\(\s*['`](\/[a-z-]+)/g;
  const found = new Set<string>();
  for (const file of sources(SRC)) {
    for (const m of readFileSync(file, 'utf8').matchAll(call)) found.add(m[1]);
  }
  return [...found].sort();
};

describe('FE-mrr-022 · the one origin forwards every api path the pages call', () => {
  it('finds the call sites it checks', () => {
    expect(calledPrefixes().length).toBeGreaterThan(0);
  });

  it('proxies every prefix a page calls — one left out comes back as index.html, not json', () => {
    const missing = calledPrefixes().filter((p) => !API_PREFIXES.includes(p));
    expect(missing).toEqual([]);
  });

  it('builds the dev proxy and the preview proxy from that one list', () => {
    expect(Object.keys(config.server?.proxy ?? {}).sort()).toEqual([...API_PREFIXES].sort());
  });
});
