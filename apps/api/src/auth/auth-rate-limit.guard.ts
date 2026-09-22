import { createHash } from 'node:crypto';
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service.js';

const RATE_LIMIT_SCRIPT = `
  for i, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('PEXPIRE', key, ARGV[3]) end
    if count > tonumber(ARGV[i]) then
      return math.max(1, math.ceil(redis.call('PTTL', key) / 1000))
    end
  end
  return 0
`;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ ip: string; body?: { email?: unknown }; params?: { token?: string } }>();
    const operation = context.getHandler().name;
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    // request.ip is resolved by Fastify; untrusted forwarded headers are ignored.
    const keys = [`trackroster:auth-rate:${operation}:ip:${digest(request.ip)}`];
    if (
      ['login', 'forgotPassword'].includes(operation) &&
      typeof request.body?.email === 'string'
    ) {
      keys.push(
        `trackroster:auth-rate:${operation}:account:${digest(request.body.email.slice(0, 320).trim().toLowerCase())}`,
      );
    }
    if (operation === 'acceptInvitation' && request.params?.token) {
      keys.push(`trackroster:auth-rate:invitation:${digest(request.params.token)}`);
    }
    const ipLimit =
      Number(this.config.get('AUTH_RATE_LIMIT_IP') ?? 60) * (operation === 'refresh' ? 5 : 1);
    const accountLimit = Number(this.config.get('AUTH_RATE_LIMIT_ACCOUNT') ?? 10);
    let retryAfter: number;
    try {
      retryAfter = Number(
        await this.redis.getClient().eval(RATE_LIMIT_SCRIPT, {
          keys,
          arguments: [String(ipLimit), String(accountLimit), '60000'],
        }),
      );
      if (!Number.isFinite(retryAfter)) throw new Error('Invalid limiter state');
    } catch {
      throw new ServiceUnavailableException('Authentication is temporarily unavailable');
    }
    if (retryAfter > 0) {
      context
        .switchToHttp()
        .getResponse<{ header(name: string, value: string): unknown }>()
        .header('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many authentication attempts. Try again shortly.',
        },
        429,
      );
    }
    return true;
  }
}
