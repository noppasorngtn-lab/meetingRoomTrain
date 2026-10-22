import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { MAIL_TRANSPORT, MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { UsersModule } from '../../src/modules/users/users.module';
import { seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

// The verbatim Thai of AC-mrr-089..103 — copied from req's examples, never rewritten.
const SENT = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';
const WRONG = 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่';
const EXPIRED = 'รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่';
const USED = 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่';
const SEND_FAILED = 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
const ALREADY_SENT = 'ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่';

/** Records what left the system, or refuses like a mail server that is down (INT-001). */
class FakeMail implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('mail server is down');
    this.sent.push(message);
  }
}

describe('FE-mrr-039 sign-in with a login code or magic link (API-031 · API-032 · API-033)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  const mail = new FakeMail();
  let now = new Date('2026-10-22T10:00:00+07:00');

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, UsersModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(MAIL_TRANSPORT).useValue(mail)
      .overrideProvider(CLOCK).useValue({ now: () => now })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  const http = () => request(app.getHttpServer());
  const at = (iso: string) => (now = new Date(`${iso}+07:00`));
  const requestCode = (email: string) => http().post('/auth/otp/request').send({ email });
  const verify = (email: string, code: string) => http().post('/auth/otp/verify').send({ email, code });
  const lastMailTo = (email: string) => [...mail.sent].reverse().find((m) => m.to.includes(email))!;
  const codeIn = (m: MailMessage) => /\b(\d{6})\b/.exec(m.text)![1];
  const sessionCookie = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('mrr_session='))?.split(';')[0];
  const me = (cookie?: string) => {
    const r = http().get('/auth/me');
    return cookie ? r.set('Cookie', cookie) : r;
  };

  it('AC-mrr-089 sends a code to an active user on the HR list and says so', async () => {
    await seedUser(db, 'U1');

    const res = await requestCode('u1@example.test').expect(200);

    expect(res.body.message).toBe(SENT);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toEqual(['u1@example.test']);
    expect(mail.sent[0].text).toMatch(/\b\d{6}\b/);
  });

  it('AC-mrr-098 signs in with the right code one second before it expires, and the session knows who', async () => {
    await seedUser(db, 'U2');
    at('2026-10-22T10:00:00');
    await requestCode('u2@example.test').expect(200);
    const code = codeIn(lastMailTo('u2@example.test'));

    at('2026-10-22T10:09:59');
    const res = await verify('u2@example.test', code).expect(200);

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect((await me(cookie).expect(200)).body).toEqual({ fullName: 'U2', role: 'GENERAL_USER' });
  });

  it('AC-mrr-102 refuses a wrong code with no session, and AC-mrr-103 the same code still works after it', async () => {
    await seedUser(db, 'U3');
    at('2026-10-22T10:00:00');
    await requestCode('u3@example.test').expect(200);
    const code = codeIn(lastMailTo('u3@example.test'));
    const wrong = code === '482931' ? '482913' : '482931';

    at('2026-10-22T10:03:00');
    const first = await verify('u3@example.test', wrong).expect(401);
    at('2026-10-22T10:04:00');
    await verify('u3@example.test', wrong).expect(401);

    expect(first.body.message).toBe(WRONG);
    expect(sessionCookie(first)).toBeUndefined();

    at('2026-10-22T10:05:00');
    const ok = await verify('u3@example.test', code).expect(200);
    expect(sessionCookie(ok)).toBeDefined();
    expect(mail.sent.filter((m) => m.to.includes('u3@example.test'))).toHaveLength(1);
  });

  it('AC-mrr-099 refuses the right code at exactly 10 minutes, as expired', async () => {
    await seedUser(db, 'U4');
    at('2026-10-22T10:00:00');
    await requestCode('u4@example.test').expect(200);
    const code = codeIn(lastMailTo('u4@example.test'));

    at('2026-10-22T10:10:00');
    const res = await verify('u4@example.test', code).expect(410);

    expect(res.body.message).toBe(EXPIRED);
    expect(sessionCookie(res)).toBeUndefined();
  });

  describe('when the mail server is down', () => {
    afterEach(() => (mail.down = false));

    it('AC-mrr-090 fails the request at once, AC-mrr-091 sends nothing later by itself, AC-mrr-092 a new request then works', async () => {
      await seedUser(db, 'U5');
      mail.down = true;
      at('2026-10-22T10:00:00');

      const failed = await requestCode('u5@example.test').expect(503);
      expect(failed.body.message).toBe(SEND_FAILED);

      mail.down = false;
      at('2026-10-22T10:30:00');
      expect(mail.sent.filter((m) => m.to.includes('u5@example.test'))).toHaveLength(0);

      at('2026-10-22T10:30:01');
      const again = await requestCode('u5@example.test').expect(200);
      expect(again.body.message).toBe(SENT);
      expect(mail.sent.filter((m) => m.to.includes('u5@example.test'))).toHaveLength(1);
    });
  });

  it('AC-mrr-093 refuses a new code one second before the old one expires, AC-mrr-094 issues one at exactly 10 minutes', async () => {
    await seedUser(db, 'U6');
    at('2026-10-22T10:00:00');
    await requestCode('u6@example.test').expect(200);

    at('2026-10-22T10:09:59');
    const refused = await requestCode('u6@example.test').expect(409);
    expect(refused.body.message).toBe(ALREADY_SENT);
    expect(mail.sent.filter((m) => m.to.includes('u6@example.test'))).toHaveLength(1);

    at('2026-10-22T10:10:00');
    const issued = await requestCode('u6@example.test').expect(200);
    expect(issued.body.message).toBe(SENT);
    expect(mail.sent.filter((m) => m.to.includes('u6@example.test'))).toHaveLength(2);
  });

  it('AC-mrr-095 issues a new code once the old one was used, before its 10 minutes are up', async () => {
    await seedUser(db, 'U7');
    at('2026-10-22T10:00:00');
    await requestCode('u7@example.test').expect(200);
    at('2026-10-22T10:02:00');
    await verify('u7@example.test', codeIn(lastMailTo('u7@example.test'))).expect(200);

    at('2026-10-22T10:04:00');
    const res = await requestCode('u7@example.test').expect(200);

    expect(res.body.message).toBe(SENT);
    expect(mail.sent.filter((m) => m.to.includes('u7@example.test'))).toHaveLength(2);
  });

  it('AC-mrr-096 answers an email off the HR list the same way, and sends nothing', async () => {
    const before = mail.sent.length;

    const res = await requestCode('u9@example.test').expect(200);

    expect(res.body.message).toBe(SENT);
    expect(mail.sent).toHaveLength(before);
  });

  it('AC-mrr-097 answers an inactive account the same way, sends nothing, and it cannot sign in', async () => {
    const u5 = await seedUser(db, 'Inactive');
    await db.updateTable('users').set({ active: false }).where('id', '=', u5).execute();
    const before = mail.sent.length;

    const res = await requestCode('inactive@example.test').expect(200);

    expect(res.body.message).toBe(SENT);
    expect(mail.sent).toHaveLength(before);
    await verify('inactive@example.test', '000000').expect(401);
  });

  describe('the magic link (API-033)', () => {
    const linkIn = (m: MailMessage) => new URL(/(https?:\/\/\S+\/auth\/magic-link\?token=\S+)/.exec(m.text)![1]);
    const open = (link: URL) => http().get(`${link.pathname}${link.search}`);

    it('AC-mrr-100 refuses the code after the link from the same email signed in, and the link session works', async () => {
      await seedUser(db, 'U10');
      at('2026-10-22T10:00:00');
      await requestCode('u10@example.test').expect(200);
      const m = lastMailTo('u10@example.test');

      at('2026-10-22T10:02:00');
      const viaLink = await open(linkIn(m)).expect(302);
      expect(viaLink.headers.location).toBe('/UI-mrr-004');
      expect((await me(sessionCookie(viaLink)).expect(200)).body.fullName).toBe('U10');

      at('2026-10-22T10:03:00');
      const res = await verify('u10@example.test', codeIn(m)).expect(409);
      expect(res.body.message).toBe(USED);
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('AC-mrr-101 refuses the link after the code from the same email signed in, before its 10 minutes are up', async () => {
      await seedUser(db, 'U11');
      at('2026-10-22T10:00:00');
      await requestCode('u11@example.test').expect(200);
      const m = lastMailTo('u11@example.test');
      at('2026-10-22T10:02:00');
      await verify('u11@example.test', codeIn(m)).expect(200);

      at('2026-10-22T10:04:00');
      const res = await open(linkIn(m)).expect(302);

      expect(res.headers.location).toBe('/UI-mrr-002?reason=used');
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('sends an expired link back to the code page as expired, with no session', async () => {
      await seedUser(db, 'U12');
      at('2026-10-22T10:00:00');
      await requestCode('u12@example.test').expect(200);

      at('2026-10-22T10:10:00');
      const res = await open(linkIn(lastMailTo('u12@example.test'))).expect(302);

      expect(res.headers.location).toBe('/UI-mrr-002?reason=expired');
      expect(sessionCookie(res)).toBeUndefined();
    });
  });

  describe('the session (seam 2)', () => {
    const signedIn = async (name: string) => {
      const id = await seedUser(db, name);
      const email = `${name.toLowerCase()}@example.test`;
      at('2026-10-22T09:00:00');
      await requestCode(email).expect(200);
      const res = await verify(email, codeIn(lastMailTo(email))).expect(200);
      return { id, cookie: sessionCookie(res)! };
    };

    it('stays open while used, and ends after 30 minutes with no request', async () => {
      const { cookie } = await signedIn('S1');

      at('2026-10-22T09:29:59');
      await me(cookie).expect(200);
      at('2026-10-22T09:59:58');
      await me(cookie).expect(200);

      at('2026-10-22T10:29:58');
      await me(cookie).expect(401);
    });

    it('is refused at exactly 30 minutes idle', async () => {
      const { cookie } = await signedIn('S2');

      at('2026-10-22T09:30:00');
      await me(cookie).expect(401);
    });

    it('ends when the account is deactivated after sign-in (BR-mrr-026)', async () => {
      const { id, cookie } = await signedIn('S3');
      await db.updateTable('users').set({ active: false }).where('id', '=', id).execute();

      at('2026-10-22T09:01:00');
      await me(cookie).expect(401);
    });

    it('is nobody with no cookie, or a cookie nobody issued', async () => {
      await me().expect(401);
      await me('mrr_session=made-up').expect(401);
    });
  });
});
