import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

/**
 * Thin wrapper over ioredis providing JSON cache helpers and a stable
 * cache-key builder (hash of query + params) used by the data-source layer.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const redis = this.config.get('redis') as { host: string; port: number; password?: string };
    this.client = new Redis({
      host: redis.host,
      port: redis.port,
      password: redis.password,
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  /** Deterministic cache key for a query + parameter set. */
  buildKey(namespace: string, payload: unknown): string {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
    return `${namespace}:${hash}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, raw, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, raw);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
