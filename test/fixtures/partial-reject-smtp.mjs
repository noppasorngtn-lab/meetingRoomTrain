// SMTP ตัวเล็กสำหรับ QA (OQ-T1-15): รับเมลได้ แต่ปฏิเสธ RCPT ของผู้รับที่ระบุ (ค่าเริ่มต้น u3@mrr.local)
// ใช้เป็น module (startRejectingSmtp) หรือรันตรง ๆ: node test/fixtures/partial-reject-smtp.mjs [port] [rejectAddr]
import net from 'node:net';

export function startRejectingSmtp({ port = 0, reject = ['u3@mrr.local'], host = '127.0.0.1' } = {}) {
  const log = { accepted: [], rejected: [], delivered: [] };
  const server = net.createServer((sock) => {
    let inData = false, rcpts = [], buf = '';
    sock.write('220 fixture ESMTP\r\n');
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; log.delivered.push([...rcpts]); if (process.env.FIXTURE_LOG) console.log('DELIVERED ' + JSON.stringify(rcpts)); sock.write('250 queued\r\n'); } continue; }
        const u = line.toUpperCase();
        if (u.startsWith('EHLO') || u.startsWith('HELO')) sock.write('250 fixture\r\n');
        else if (u.startsWith('MAIL FROM')) { rcpts = []; sock.write('250 ok\r\n'); }
        else if (u.startsWith('RCPT TO')) {
          const a = (line.match(/<([^>]+)>/) || [])[1]?.toLowerCase();
          if (reject.includes(a)) { log.rejected.push(a); if (process.env.FIXTURE_LOG) console.log('REJECTED ' + a); sock.write('550 5.1.1 recipient rejected\r\n'); }
          else { log.accepted.push(a); rcpts.push(a); sock.write('250 ok\r\n'); }
        } else if (u === 'DATA') { inData = true; sock.write('354 go\r\n'); }
        else if (u === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 ok\r\n');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise((res) => server.listen(port, host, () => res({ server, port: server.address().port, log })));
}

if (process.argv[1]?.endsWith('partial-reject-smtp.mjs')) {
  const [p, r] = process.argv.slice(2);
  const host = process.env.FIXTURE_HOST || '127.0.0.1';
  const { port } = await startRejectingSmtp({ port: Number(p || 2525), reject: [r || 'u3@mrr.local'], host });
  console.log(`partial-reject SMTP listening on ${host}:${port}`);
}
