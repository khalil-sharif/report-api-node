import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedReport, Prisma, ReportFormat, ReportStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StorageService } from 'src/common/storage/storage.service';
import { validateParameters } from 'src/common/validation/parameter-validator';
import type { AuthUser } from 'src/common/auth/current-user';
import type { LayoutConfig, ParametersSchema } from 'src/common/types/report.types';
import {
  GenerateJobData,
  JOB_GENERATE,
  QUEUE_REPORTS,
} from 'src/queue/queue.constants';
import { DataSourceService } from '../data-sources/data-source.service';
import { GeneratorService } from '../generators/generator.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { bindParameters } from './sql-binder';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: DataSourceService,
    private readonly generators: GeneratorService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_REPORTS) private readonly queue: Queue,
  ) {}

  /** Validate + enqueue an async generation. Returns the job + report id. */
  async enqueue(dto: GenerateReportDto, user: AuthUser) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);
    if (!template.isActive) throw new BadRequestException('Template is inactive');

    // Access control
    if (!user.roles.includes('admin')) {
      const ok = template.accessRoles.some((r) => user.roles.includes(r));
      if (!ok) throw new ForbiddenException('You may not generate this report');
    }

    if (!template.supportedFormats.includes(dto.format)) {
      throw new BadRequestException(
        `Template supports [${template.supportedFormats.join(', ')}], not "${dto.format}"`,
      );
    }

    // Validate params now so the caller gets immediate feedback (not via a failed job).
    const schema = template.parametersSchemaJson as unknown as ParametersSchema;
    const validated = validateParameters(schema, dto.parameters ?? {});

    const report = await this.prisma.generatedReport.create({
      data: {
        templateId: template.id,
        parametersJson: dto.parameters as Prisma.InputJsonValue,
        format: dto.format,
        status: ReportStatus.queued,
        generatedBy: user.id,
      },
    });

    const jobData: GenerateJobData = {
      reportId: report.id,
      templateId: template.id,
      parameters: validated as Record<string, unknown>,
      format: dto.format,
      userId: user.id,
    };
    const job = await this.queue.add(JOB_GENERATE, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    await this.prisma.generatedReport.update({
      where: { id: report.id },
      data: { jobId: String(job.id) },
    });

    return { jobId: String(job.id), reportId: report.id, status: 'queued' as const };
  }

  /** Poll status by BullMQ job id. */
  async getStatus(jobId: string) {
    const report = await this.prisma.generatedReport.findFirst({ where: { jobId } });
    if (!report) throw new NotFoundException(`No report for job ${jobId}`);

    const base = {
      jobId,
      reportId: report.id,
      status: report.status,
    };
    if (report.status === ReportStatus.completed) {
      return {
        ...base,
        downloadUrl: report.filePath
          ? await this.storage.presignedUrl(report.filePath)
          : null,
        fileSize: report.fileSize,
        generationTimeMs: report.generationTimeMs,
        rowCount: report.rowCount,
      };
    }
    if (report.status === ReportStatus.failed) {
      return { ...base, error: report.error };
    }
    return base;
  }

  /**
   * Core generation used by both the async processor and scheduled runs.
   * Fetches data, renders the file, uploads to storage, updates the record.
   */
  async runGeneration(input: {
    reportId: string;
    parameters: Record<string, unknown>;
  }): Promise<GeneratedReport> {
    const started = Date.now();
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: input.reportId },
      include: { template: true },
    });
    if (!report) throw new NotFoundException(`Report ${input.reportId} not found`);
    const template = report.template;

    await this.prisma.generatedReport.update({
      where: { id: report.id },
      data: { status: ReportStatus.processing },
    });

    try {
      const schema = template.parametersSchemaJson as unknown as ParametersSchema;
      const layout = template.layoutConfigJson as unknown as LayoutConfig;
      const validated = validateParameters(schema, input.parameters ?? {});
      const bind = bindParameters(template.dataQuery, schema, validated);

      const ttl =
        template.cacheTtlSeconds ??
        (this.config.get('cache') as { defaultTtl: number }).defaultTtl;

      const dataset = await this.dataSource.fetch({
        sql: template.dataQuery,
        bind,
        dataSource: template.dataSource,
        layout,
        cacheKeyNamespace: `report:${template.id}`,
        ttlSeconds: ttl,
      });

      const company = this.config.get('company') as { name: string; logoPath?: string };
      const result = await this.generators.generate(report.format as 'pdf' | 'xlsx' | 'csv', {
        layout,
        dataset,
        parameters: validated,
        meta: {
          templateName: template.name,
          generatedBy: report.generatedBy,
          generatedAt: new Date(),
          companyName: company.name,
          companyLogoPath: company.logoPath,
        },
      });

      const objectKey = `${template.id}/${report.id}.${result.extension}`;
      const fileSize = await this.storage.putObject(
        objectKey,
        result.buffer,
        result.contentType,
      );

      const retentionDays =
        template.retentionDays ??
        (this.config.get('retention') as { defaultDays: number }).defaultDays;
      const expiresAt = new Date(Date.now() + retentionDays * 864e5);

      const updated = await this.prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.completed,
          filePath: objectKey,
          fileSize,
          rowCount: dataset.rowCount,
          generationTimeMs: Date.now() - started,
          expiresAt,
          error: null,
        },
      });
      this.logger.log(
        `Generated ${report.format} report ${report.id} (${dataset.rowCount} rows, ${fileSize} bytes)`,
      );
      return updated;
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Generation failed for ${report.id}: ${message}`);
      await this.prisma.generatedReport.update({
        where: { id: report.id },
        data: { status: ReportStatus.failed, error: message },
      });
      throw err;
    }
  }

  async list(query: ListReportsDto, user: AuthUser) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const where: Prisma.GeneratedReportWhereInput = {};
    if (query.templateId) where.templateId = query.templateId;
    if (query.format) where.format = query.format as ReportFormat;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.to);
    }
    // Ownership: non-admins only see their own reports.
    if (user.roles.includes('admin')) {
      if (query.generatedBy) where.generatedBy = query.generatedBy;
    } else {
      where.generatedBy = user.id;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.generatedReport.count({ where }),
      this.prisma.generatedReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  private async loadOwned(id: string, user: AuthUser): Promise<GeneratedReport> {
    const report = await this.prisma.generatedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    if (!user.roles.includes('admin') && report.generatedBy !== user.id) {
      throw new ForbiddenException('You may only access your own reports');
    }
    return report;
  }

  async download(id: string, user: AuthUser) {
    const report = await this.loadOwned(id, user);
    if (report.status !== ReportStatus.completed || !report.filePath) {
      throw new BadRequestException(`Report ${id} is not ready (status: ${report.status})`);
    }
    const url = await this.storage.presignedUrl(report.filePath);
    return { downloadUrl: url, fileName: report.filePath.split('/').pop(), format: report.format };
  }

  async remove(id: string, user: AuthUser) {
    const report = await this.loadOwned(id, user);
    if (report.filePath) {
      try {
        await this.storage.remove(report.filePath);
      } catch (err) {
        this.logger.warn(`Could not remove object ${report.filePath}: ${(err as Error).message}`);
      }
    }
    await this.prisma.generatedReport.delete({ where: { id } });
    return { id, deleted: true };
  }
}
