import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface Caller {
  userId: string;
}

/**
 * The signed-in user, as the sign-in guard leaves it on the request. Until that guard exists
 * (GAP-mrr-003) there is never one, so every call is 401 — there is no back door to fake it.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Caller => {
  const user = ctx.switchToHttp().getRequest().user as Caller | undefined;
  if (!user?.userId) throw new UnauthorizedException();
  return user;
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
