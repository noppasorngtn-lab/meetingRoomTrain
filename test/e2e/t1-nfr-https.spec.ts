import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { expect, test } from '@playwright/test';

/**
 * NFR-mrr-003 (HTTPS) — TC-NFR-REQ001-103, option A (dev TLS front, docker/Caddyfile).
 * [real] Talks to the dev stack's tls-proxy on :4443. The certificate is Caddy's own throw-away local CA, so the
 * client does not verify the chain (`rejectUnauthorized: false`) — this proves "encrypted in transit", not "trusted CA".
 * Plain :4173 / :3000 stay HTTP for the rest of the suite; this case does NOT claim they are closed (see OQ-NFR-HTTPS).
 */
const HOST = 'localhost';
const TLS_PORT = 4443;

const tlsHandshake = () =>
  new Promise<{ protocol: string | null; authorized: boolean }>((resolve, reject) => {
    const s = tls.connect({ host: HOST, port: TLS_PORT, servername: HOST, rejectUnauthorized: false }, () => {
      resolve({ protocol: s.getProtocol(), authorized: s.authorized });
      s.end();
    });
    s.on('error', reject);
  });

const httpsGet = () =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    https
      .get({ host: HOST, port: TLS_PORT, path: '/', timeout: 5000, rejectUnauthorized: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on('error', reject);
  });

const plainGet = () =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    http
      .get({ host: HOST, port: TLS_PORT, path: '/', timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on('error', reject);
  });

test('[real] TC-NFR-REQ001-103 ทางเข้า HTTPS ใช้ TLS 1.2+ และ HTTP ธรรมดาที่พอร์ตเดียวกันไม่ได้เนื้อหาของระบบ (NFR-mrr-003)', async () => {
  const hs = await tlsHandshake();
  expect(['TLSv1.2', 'TLSv1.3']).toContain(hs.protocol);

  const secure = await httpsGet();
  expect(secure.status).toBe(200);
  expect(secure.body).toContain('<div id="root"'); // เนื้อหาของระบบมาทางช่องที่เข้ารหัส

  const plain = await plainGet();
  expect(plain.status).toBe(400);
  expect(plain.body).not.toContain('<div id="root"');
  expect(plain.body.toLowerCase()).not.toContain('<html');
});
