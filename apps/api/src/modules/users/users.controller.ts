import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Caller, CurrentUser } from '../../common/auth/current-user';
import { UserOption, UsersService } from './users.service';

/** API-005 — any signed-in user may look people up; only active users are offered. */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async search(@CurrentUser() _caller: Caller, @Query('query') query: unknown): Promise<UserOption[]> {
    const text = typeof query === 'string' ? query.trim() : '';
    if (!text) throw new BadRequestException('query ต้องไม่ว่าง');
    return this.users.search(text);
  }
}
