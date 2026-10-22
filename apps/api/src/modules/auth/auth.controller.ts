import {
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { sessionCookie } from './session.middleware';
import { SessionsService } from './sessions.service';
import { CODE_SENT, CodeNotSent, CodeStillValid, SignInRefused, SignInService } from './sign-in.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signIn: SignInService,
    private readonly sessions: SessionsService,
  ) {}

  /** API-031 */
  @Post('otp/request')
  @HttpCode(200)
  async request(@Body() body: { email?: unknown }): Promise<{ message: string }> {
    await this.signIn.requestCode(String(body?.email ?? '')).catch(asHttp);
    return { message: CODE_SENT };
  }

  /** API-032 — a right code opens a session; the page then goes to the room search, with no message. */
  @Post('otp/verify')
  @HttpCode(200)
  async verify(@Body() body: { email?: unknown; code?: unknown }, @Res({ passthrough: true }) res: any): Promise<object> {
    const userId = await this.signIn
      .verifyCode(String(body?.email ?? ''), String(body?.code ?? ''))
      .catch(asHttp);
    res.setHeader('Set-Cookie', sessionCookie(await this.sessions.open(userId)));
    return {};
  }

  /**
   * API-033 — a link opened from the email. It signs in and lands on the room search; a link that
   * cannot be used lands on the code page, which shows the same sentence the code would (UI-mrr-002).
   */
  @Get('magic-link')
  async magicLink(@Query('token') token: unknown, @Res() res: any): Promise<void> {
    try {
      const userId = await this.signIn.useMagicLink(String(token ?? ''));
      res.setHeader('Set-Cookie', sessionCookie(await this.sessions.open(userId)));
      res.redirect(302, '/UI-mrr-004');
    } catch (err) {
      if (!(err instanceof SignInRefused)) throw err;
      res.redirect(302, `/UI-mrr-002?reason=${err.reason.toLowerCase()}`);
    }
  }
}

/** Each refusal keeps the sentence the user reads (AC-mrr-089..103). */
function asHttp(err: unknown): never {
  if (err instanceof CodeNotSent) throw new ServiceUnavailableException(err.message);
  if (err instanceof CodeStillValid) throw new ConflictException(err.message);
  if (err instanceof SignInRefused) {
    if (err.reason === 'WRONG') throw new UnauthorizedException(err.message);
    if (err.reason === 'EXPIRED') throw new GoneException(err.message);
    throw new ConflictException(err.message);
  }
  throw err;
}
