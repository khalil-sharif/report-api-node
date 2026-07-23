import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import type {
  DataRow,
  LayoutConfig,
  ReportDataset,
  SummaryConfig,
  SummaryStat,
} from 'src/common/types/report.types';

/**
 * Executes template SQL against a configured connection with BOUND parameters
 * (never string interpolation), caches result sets in Redis, and derives the
 * summary statistics declared in the layout config.
 */
@Injectable()
export class DataSourceService implements OnModuleDestroy {
  private readonly logger = new Logger(DataSourceService.name);
  private analytics?: PrismaClient;

  constructor(
    @Inject(PrismaService) private readonly primary: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    const analyticsUrl = this.config.get<string>('analyticsDatabaseUrl');
    if (analyticsUrl) {
      this.analytics = new PrismaClient({ datasources: { db: { url: analyticsUrl } } });
    }
  }

  private connectionFor(name: string): PrismaClient {
    if (name === 'analytics' && this.analytics) return this.analytics;
    return this.primary;
  }

  /**
   * Runs the query (or serves from cache) and returns rows + summary stats.
   * @param bind ordered parameter values bound to $1..$n in the SQL.
   */
  async fetch(params: {
    sql: string;
    bind: unknown[];
    dataSource: string;
    layout: LayoutConfig;
    cacheKeyNamespace: string;
    ttlSeconds: number;
    skipCache?: boolean;
  }): Promise<ReportDataset> {
    const cacheKey = this.redis.buildKey(params.cacheKeyNamespace, {
      sql: params.sql,
      bind: params.bind,
      ds: params.dataSource,
    });

    if (!params.skipCache) {
      const cached = await this.redis.getJson<{ rows: DataRow[] }>(cacheKey);
      if (cached) {
        const summary = computeSummary(cached.rows, params.layout.summary ?? []);
        return { rows: cached.rows, summary, rowCount: cached.rows.length, fromCache: true };
      }
    }

    const client = this.connectionFor(params.dataSource);
    let rows: DataRow[];
    try {
      rows = await client.$queryRawUnsafe<DataRow[]>(params.sql, ...params.bind);
    } catch (err) {
      this.logger.error(`Query failed: ${(err as Error).message}`);
      throw err;
    }

    // BigInt (e.g. COUNT) is not JSON-serializable — normalize to Number.
    const normalized = rows.map(normalizeRow);

    if (params.ttlSeconds > 0) {
      await this.redis.setJson(cacheKey, { rows: normalized }, params.ttlSeconds);
    }

    const summary = computeSummary(normalized, params.layout.summary ?? []);
    return { rows: normalized, summary, rowCount: normalized.length, fromCache: false };
  }

  async onModuleDestroy(): Promise<void> {
    await this.analytics?.$disconnect();
  }
}

function normalizeRow(row: DataRow): DataRow {
  const out: DataRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') out[k] = Number(v);
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

export function computeSummary(rows: DataRow[], config: SummaryConfig[]): SummaryStat[] {
  return config.map((c) => {
    const nums = rows
      .map((r) => Number(r[c.field]))
      .filter((n) => Number.isFinite(n));
    let value = 0;
    switch (c.op) {
      case 'sum':
        value = nums.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        break;
      case 'count':
        value = rows.length;
        break;
      case 'min':
        value = nums.length ? Math.min(...nums) : 0;
        break;
      case 'max':
        value = nums.length ? Math.max(...nums) : 0;
        break;
    }
    return { label: c.label, field: c.field, op: c.op, value, format: c.format };
  });
}
