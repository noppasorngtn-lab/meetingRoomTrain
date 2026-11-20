import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * OQ-T1-15: an SMTP server that refuses ONE recipient (u3) while accepting the rest.
 * mailpit can only be down or up, so for this case we swap it: stop mrr-mailpit-1 and start a throwaway container
 * on the stack's network with the alias `mailpit` and port 1025 — the api keeps its own SMTP_HOST=mailpit, no config change.
 * The container reuses the api image (it already has node). `stopPartialRejectMail` removes it; mail.ts `mailUp` brings mailpit back.
 */
const NAME = 'mrr-smtp-reject-u3';
const NETWORK = 'mrr_default';
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures');
const docker = (...a: string[]) => execFileSync('docker', a, { encoding: 'utf8' });

export function startPartialRejectMail(rejectAddr = 'u3@mrr.local') {
  stopPartialRejectMail();
  docker('stop', '-t', '1', 'mrr-mailpit-1');
  docker(
    'run', '-d', '--name', NAME, '--network', NETWORK, '--network-alias', 'mailpit',
    '-e', 'FIXTURE_LOG=1', '-e', 'FIXTURE_HOST=0.0.0.0',
    '-v', `${FIXTURES}:/f:ro`, 'mrr-api', 'node', '/f/partial-reject-smtp.mjs', '1025', rejectAddr,
  );
  // Wait until it is listening: a job that ran before this would fail on "connection refused", not on the rejected recipient.
  for (let i = 0; i < 40; i++) {
    if (docker('logs', NAME).includes('listening')) return;
    execFileSync('node', ['-e', 'setTimeout(()=>{},250)']);
  }
  throw new Error('SMTP fixture did not start');
}

/** Recipients the fixture refused (RCPT answered 550) — proof that a failure came from the rejection. */
export function rejectedByFixture(): string[] {
  return docker('logs', NAME)
    .split(/\r?\n/)
    .filter((l) => l.startsWith('REJECTED '))
    .map((l) => l.slice('REJECTED '.length));
}

/** Addresses each accepted message was delivered to (one array per message), read from the fixture's log. */
export function deliveredByFixture(): string[][] {
  return docker('logs', NAME)
    .split(/\r?\n/)
    .filter((l) => l.startsWith('DELIVERED '))
    .map((l) => JSON.parse(l.slice('DELIVERED '.length)) as string[]);
}

export function stopPartialRejectMail() {
  try { docker('rm', '-f', NAME); } catch { /* not running */ }
}
