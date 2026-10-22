import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { MAIL_TRANSPORT, MailTransport } from '../notification/mail-transport';
import { hash, newCode, newToken } from './tokens';

/** Code and magic link live 10 minutes: usable while now < expires_at (BR-mrr-027). */
const CODE_LIFETIME_MS = 10 * 60 * 1000;

/** The one answer to every request that did not fail, listed or not (BR-mrr-026). */
export const CODE_SENT = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';

/** Why a code or a link did not open a session (BR-mrr-027 · BR-mrr-028) — the text is what the user sees. */
export class SignInRefused extends Error {
  static wrong = () => new SignInRefused('WRONG', 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่');
  static expired = () => new SignInRefused('EXPIRED', 'รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่');
  static used = () => new SignInRefused('USED', 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่');

  private constructor(
    readonly reason: 'WRONG' | 'EXPIRED' | 'USED',
    message: string,
  ) {
    super(message);
    this.name = 'SignInRefused';
  }
}

/** A usable code was already sent to this user — no new one until it expires or is used (BR-mrr-025). */
export class CodeStillValid extends Error {
  constructor() {
    super('ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่');
    this.name = 'CodeStillValid';
  }
}

/** The email did not leave: the request fails now and the user asks again (BR-mrr-024 · INT-001). */
export class CodeNotSent extends Error {
  constructor(readonly cause: unknown) {
    super('ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    this.name = 'CodeNotSent';
  }
}

/** Two requests at once both pass the check; the partial unique index stops the second (BR-mrr-025). */
const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === '23505';

/** Where the magic link points — the web origin, which forwards /auth to this api. */
const appBaseUrl = () => (process.env.APP_BASE_URL ?? 'http://localhost:4173').replace(/\/+$/, '');

/** One email carries both ways in: the six digits and the link (BR-mrr-027). */
const signInMail = (to: string, code: string, token: string) => ({
  to: [to],
  subject: '[จองห้องประชุม] รหัสเข้าสู่ระบบ',
  text: [
    `รหัสเข้าสู่ระบบของคุณคือ ${code}`,
    'หรือกดลิงก์นี้เพื่อเข้าสู่ระบบแทนการกรอกรหัส:',
    `${appBaseUrl()}/auth/magic-link?token=${token}`,
    'รหัสและลิงก์ใช้ได้ 10 นาที และใช้เข้าสู่ระบบได้ครั้งเดียว',
  ].join('\n'),
});

interface CodeRow {
  id: string;
  user_id: string;
  code_hash: string;
  status: 'ISSUED' | 'USED' | 'EXPIRED';
  expires_at: Date;
}

@Injectable()
export class SignInService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(MAIL_TRANSPORT) private readonly mail: MailTransport,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** API-031 — issue a code and a magic link to an active listed user, in one email. */
  async requestCode(email: string): Promise<void> {
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'email'])
      .where((eb) => eb(eb.fn('lower', ['email']), '=', email.trim().toLowerCase()))
      .where('active', '=', true)
      .executeTakeFirst();
    if (!user) return;

    const now = this.clock.now();
    const code = newCode();
    const token = newToken();
    const expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS);
    // One transaction: if the email does not leave, the code was never issued — no row stays
    // behind to count as a usable code, and nothing is queued to send later (BR-mrr-024).
    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('login_codes')
        .set({ status: 'EXPIRED' })
        .where('user_id', '=', user.id)
        .where('status', '=', 'ISSUED')
        .where('expires_at', '<=', now)
        .execute();
      try {
        await tx
          .insertInto('login_codes')
          .values({
            user_id: user.id,
            code_hash: hash(code),
            magic_link_token_hash: hash(token),
            issued_at: now,
            expires_at: expiresAt,
            used_at: null,
            used_via: null,
          })
          .execute();
      } catch (err) {
        if (isUniqueViolation(err)) throw new CodeStillValid();
        throw err;
      }
      await this.mail.send(signInMail(user.email, code, token)).catch((err) => {
        throw new CodeNotSent(err);
      });
    });
  }

  /**
   * API-032 — the user whose latest code this is, once it has been used to sign in. A wrong code
   * changes nothing: the same code can be typed again until it expires (BR-mrr-028).
   */
  async verifyCode(email: string, code: string): Promise<string> {
    const row = await this.db
      .selectFrom('login_codes')
      .innerJoin('users', 'users.id', 'login_codes.user_id')
      .select(['login_codes.id', 'login_codes.user_id', 'login_codes.code_hash', 'login_codes.status', 'login_codes.expires_at'])
      .where((eb) => eb(eb.fn('lower', ['users.email']), '=', email.trim().toLowerCase()))
      .where('users.active', '=', true)
      .orderBy('login_codes.issued_at', 'desc')
      .executeTakeFirst();
    if (!row) throw SignInRefused.wrong();
    this.refuseUnusable(row);
    if (row.code_hash !== hash(code)) throw SignInRefused.wrong();
    return this.use(row, 'CODE');
  }

  /** API-033 — the user whose magic link this is, once it has been used to sign in (BR-mrr-027). */
  async useMagicLink(token: string): Promise<string> {
    const row = await this.db
      .selectFrom('login_codes')
      .innerJoin('users', 'users.id', 'login_codes.user_id')
      .select(['login_codes.id', 'login_codes.user_id', 'login_codes.code_hash', 'login_codes.status', 'login_codes.expires_at'])
      .where('login_codes.magic_link_token_hash', '=', hash(token))
      .where('users.active', '=', true)
      .executeTakeFirst();
    if (!row) throw SignInRefused.wrong();
    this.refuseUnusable(row);
    return this.use(row, 'MAGIC_LINK');
  }

  /** A code already used, or past its 10 minutes, opens nothing — checked before the code itself. */
  private refuseUnusable(row: CodeRow): void {
    if (row.status === 'USED') throw SignInRefused.used();
    if (row.status === 'EXPIRED' || this.clock.now() >= row.expires_at) throw SignInRefused.expired();
  }

  /**
   * ISSUED → USED, once: the conditional update is what makes the code and its magic link usable a
   * single time between them, even when both arrive together (BR-mrr-027 · STM-mrr-004).
   */
  private async use(row: CodeRow, via: 'CODE' | 'MAGIC_LINK'): Promise<string> {
    const now = this.clock.now();
    const done = await this.db
      .updateTable('login_codes')
      .set({ status: 'USED', used_at: now, used_via: via })
      .where('id', '=', row.id)
      .where('status', '=', 'ISSUED')
      .where('expires_at', '>', now)
      .executeTakeFirst();
    if (done.numUpdatedRows === 0n) throw SignInRefused.used();
    return row.user_id;
  }
}
