import { execFileSync } from 'node:child_process';

/**
 * A mail server that is really down (OQ-T1-03): stop the dev stack's mailpit container, start it again after.
 * Mailpit keeps its messages in memory, so a restart empties the inbox — tests that need an inbox clear it anyway.
 */
const CONTAINER = 'mrr-mailpit-1';
const MAILPIT = 'http://localhost:8025/api/v1/messages';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' });

export async function mailDown() {
  docker('stop', '-t', '1', CONTAINER);
}

export async function mailUp() {
  docker('start', CONTAINER);
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(MAILPIT)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('mailpit did not come back');
}

/** Safe to call anywhere: starts the container if it is not running. */
export async function ensureMailUp() {
  if (docker('ps', '--filter', `name=${CONTAINER}`, '--format', '{{.Names}}').trim() !== CONTAINER) await mailUp();
}
