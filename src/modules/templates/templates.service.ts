import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportTemplate } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { DataSourceService } from '../data-sources/data-source.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { bindParameters } from '../reports/sql-binder';
import { sampleParameters, validateParameters } from 'src/common/validation/parameter-validator';
import type { AuthUser } from 'src/common/auth/current-user';
import type {
  LayoutConfig,
  ParametersSchema,
} from 'src/common/types/report.types';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: DataSourceService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateTemplateDto): Promise<ReportTemplate> {
    return this.prisma.reportTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        dataQuery: dto.dataQuery,
        dataSource: dto.dataSource ?? 'primary',
        parametersSchemaJson: dto.parametersSchema as Prisma.InputJsonValue,
        supportedFormats: dto.supportedFormats,
        layoutConfigJson: dto.layoutConfig as Prisma.InputJsonValue,
        accessRoles: dto.accessRoles,
        cacheTtlSeconds: dto.cacheTtlSeconds ?? null,
        retentionDays: dto.retentionDays ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(user: AuthUser): Promise<ReportTemplate[]> {
    const all = await this.prisma.reportTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Non-admins only see templates they may run.
    if (user.roles.includes('admin')) return all;
    return all.filter((t) => t.accessRoles.some((r) => user.roles.includes(r)));
  }

  async findOne(id: string): Promise<ReportTemplate> {
    const template = await this.prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ReportTemplate> {
    await this.findOne(id);
    const data: Prisma.ReportTemplateUpdateInput = {
      name: dto.name,
      description: dto.description,
      dataQuery: dto.dataQuery,
      dataSource: dto.dataSource,
      supportedFormats: dto.supportedFormats,
      accessRoles: dto.accessRoles,
      cacheTtlSeconds: dto.cacheTtlSeconds,
      retentionDays: dto.retentionDays,
      isActive: dto.isActive,
    };
    if (dto.parametersSchema) data.parametersSchemaJson = dto.parametersSchema as Prisma.InputJsonValue;
    if (dto.layoutConfig) data.layoutConfigJson = dto.layoutConfig as Prisma.InputJsonValue;
    return this.prisma.reportTemplate.update({ where: { id }, data });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.prisma.reportTemplate.delete({ where: { id } });
    return { id };
  }

  /** Enforce that the user holds one of the template's access roles. */
  assertCanAccess(template: ReportTemplate, user: AuthUser): void {
    if (user.roles.includes('admin')) return;
    const ok = template.accessRoles.some((r) => user.roles.includes(r));
    if (!ok) {
      throw new ForbiddenException(
        `You lack a role required to use template "${template.name}"`,
      );
    }
  }

  /** Preview a template with auto-generated sample parameters. */
  async preview(id: string, user: AuthUser) {
    const template = await this.findOne(id);
    this.assertCanAccess(template, user);

    const schema = template.parametersSchemaJson as unknown as ParametersSchema;
    const layout = template.layoutConfigJson as unknown as LayoutConfig;
    const sample = validateParameters(schema, sampleParameters(schema));
    const bind = bindParameters(template.dataQuery, schema, sample);

    const dataset = await this.dataSource.fetch({
      sql: template.dataQuery,
      bind,
      dataSource: template.dataSource,
      layout,
      cacheKeyNamespace: `preview:${template.id}`,
      ttlSeconds: 30,
    });

    return {
      template: { id: template.id, name: template.name },
      sampleParameters: sample,
      layout,
      rowCount: dataset.rowCount,
      summary: dataset.summary,
      rows: dataset.rows.slice(0, 20),
    };
  }
}
