import { Controller, Get } from '@nestjs/common';
import { Caller, CurrentUser } from '../../common/auth/current-user';
import { Me, UsersService } from './users.service';

/**
 * API-035 — the caller's own name and role, so a screen can show or hide its commands (ADR-003).
 * It takes no parameter naming anybody else, and hiding a button is not authorisation: every
 * command is still refused by its own endpoint.
 */
@Controller('auth')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() caller: Caller): Promise<Me> {
    return this.users.me(caller.userId);
  }
}
