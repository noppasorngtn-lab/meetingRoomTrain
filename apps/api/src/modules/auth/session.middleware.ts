import { Injectable, NestMiddleware } from '@nestjs/common';
import { SessionsService } from './sessions.service';

export const SESSION_COOKIE = 'mrr_session';

/** The value of one cookie in a Cookie header — enough for the one cookie this api sets. */
export const readCookie = (header: string | undefined, name: string): string | undefined =>
  header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

/** HttpOnly so page script never sees it · Secure where the deployment serves HTTPS (NFR-mrr-003). */
export const sessionCookie = (token: string): string =>
  [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', ...(process.env.COOKIE_SECURE === 'true' ? ['Secure'] : [])].join('; ');

/** The sign-in guard: a live session becomes request.user, which CurrentUser reads. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionsService) {}

  async use(req: any, _res: unknown, next: (err?: unknown) => void): Promise<void> {
    try {
      const token = readCookie(req.headers?.cookie, SESSION_COOKIE);
      const userId = token ? await this.sessions.resolve(token) : null;
      if (userId) req.user = { userId };
      next();
    } catch (err) {
      next(err);
    }
  }
}
