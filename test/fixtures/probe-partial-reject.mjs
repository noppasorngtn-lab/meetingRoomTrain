// พิสูจน์: SmtpMailTransport.send() โยน error ไหมเมื่อผู้รับบางคนถูกปฏิเสธ (BR-mrr-020@v2 / EX-mrr-112)
// ใช้โค้ดที่ build แล้วที่ apps/api/dist — รัน: node test/fixtures/probe-partial-reject.mjs
import { createRequire } from 'node:module';
import { startRejectingSmtp } from './partial-reject-smtp.mjs';
const require = createRequire(import.meta.url);
const { SmtpMailTransport } = require('../../apps/api/dist/modules/notification/smtp-mail-transport.js');

const { server, port, log } = await startRejectingSmtp();
const t = new SmtpMailTransport({ host: '127.0.0.1', port, from: 'no-reply@mrr.local' });
const msg = (to) => ({ to, subject: '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: E2E probe', text: 'probe' });
for (const [name, to] of [['u1,u2,u3 (u3 ถูกปฏิเสธ)', ['u1@mrr.local', 'u2@mrr.local', 'u3@mrr.local']], ['u3 คนเดียว', ['u3@mrr.local']]]) {
  const before = log.delivered.length;
  let r; try { await t.send(msg(to)); r = 'send() สำเร็จ (ไม่โยน error)'; } catch (e) { r = `send() โยน error: ${e.message}`; }
  console.log(`${name} → ${r} · เมลถึงจริง: ${JSON.stringify(log.delivered.slice(before))}`);
}
console.log('rejected by server:', log.rejected);
server.close();
