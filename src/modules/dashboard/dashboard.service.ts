import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { validateParameters } from 'src/common/validation/parameter-validator';
import type { AuthUser } from 'src/common/auth/current-user';
import type { LayoutConfig, ParametersSchema } from 'src/common/types/report.types';
import { DataSourceService } from '../data-sources/data-source.service';
import { aggregateForChart } from '../generators/chart.util';
import { bindParameters } from '../reports/sql-binder';

/**
 * Returns a template's data as JSON (rows + summary + chart series) for
 * frontend dashboards that don't need a rendered file. Uses a short cache TTL.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: DataSourceService,
    private readonly config: ConfigService,
  ) {}

  async getData(templateId: string, query: Record<string, unknown>, user: AuthUser) {
    const template = await this.prisma.reportTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    if (!user.roles.includes('admin')) {
      const ok = template.accessRoles.some((r) => user.roles.includes(r));
      if (!ok) throw new ForbiddenException('You may not access this dashboard');
    }

    const schema = template.parametersSchemaJson as unknown as ParametersSchema;
    const layout = template.layoutConfigJson as unknown as LayoutConfig;
    const validated = validateParameters(schema, query ?? {});
    const bind = bindParameters(template.dataQuery, schema, validated);

    const ttl = (this.config.get('cache') as { dashboardTtl: number }).dashboardTtl;
    const dataset = await this.dataSource.fetch({
      sql: template.dataQuery,
      bind,
      dataSource: template.dataSource,
      layout,
      cacheKeyNamespace: `dashboard:${template.id}`,
      ttlSeconds: ttl,
    });

    const chart = layout.chart
      ? { config: layout.chart, series: aggregateForChart(dataset.rows, layout.chart) }
      : null;

    return {
      template: { id: template.id, name: template.name },
      parameters: validated,
      summary: dataset.summary,
      chart,
      rowCount: dataset.rowCount,
      fromCache: dataset.fromCache,
      rows: dataset.rows,
    };
  }
}
