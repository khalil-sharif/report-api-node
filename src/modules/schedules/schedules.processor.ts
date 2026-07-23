import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StorageService } from 'src/common/storage/storage.service';
import { MailService } from 'src/common/mail/mail.service';
import {
  JOB_RUN_SCHEDULE,
  QUEUE_SCHEDULES,
  RunScheduleJobData,
} from 'src/queue/queue.constants';
import { ReportsService } from '../reports/reports.service';

/**
 * Fires when a schedule's cron matches. Generates the report, then emails
 * recipients — attaching the file when small enough, else a download link.
 */
@Processor(QUEUE_SCHEDULES, { concurrency: 2 })
export class SchedulesProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulesProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<RunScheduleJobData>): Promise<void> {
    if (job.name !== JOB_RUN_SCHEDULE) return;
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: job.data.scheduleId },
      include: { template: true },
    });
    if (!schedule || !schedule.isActive) {
      this.logger.warn(`Schedule ${job.data.scheduleId} missing or inactive; skipping.`);
      return;
    }

    this.logger.log(`Running schedule ${schedule.id} (${schedule.template.name})`);

    const report = await this.prisma.generatedReport.create({
      data: {
        templateId: schedule.templateId,
        parametersJson: schedule.parametersJson,
        format: schedule.format,
        status: ReportStatus.queued,
        generatedBy: `schedule:${schedule.id}`,
      },
    });

    const generated = await this.reports.runGeneration({
      reportId: report.id,
      parameters: schedule.parametersJson as Record<string, unknown>,
    });

    await this.deliver(schedule, generated);

    const nextRunAt = job.opts.repeat
      ? new Date(Date.now() + 0) // BullMQ computes real next run; store best-effort now.
      : null;
    await this.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: new Date(), nextRunAt },
    });
  }

  private async deliver(
    schedule: { recipientsJson: unknown; template: { name: string } },
    report: { id: string; filePath: string | null; fileSize: number | null; format: string },
  ): Promise<void> {
    const recipients = (schedule.recipientsJson as string[]) ?? [];
    if (!recipients.length || !report.filePath) return;

    const mailCfg = this.config.get('mail') as { attachMaxBytes: number };
    const url = await this.storage.presignedUrl(report.filePath);
    const small = (report.fileSize ?? 0) <= mailCfg.attachMaxBytes;

    const html = `
      <h2>${schedule.template.name}</h2>
      <p>Your scheduled ${report.format.toUpperCase()} report is ready.</p>
      ${small ? '<p>The report is attached to this email.</p>' : `<p><a href="${url}">Download report</a> (link valid for a limited time).</p>`}
      <hr/>
      <p style="color:#6b7280;font-size:12px">Report id: ${report.id}</p>
    `;

    const attachments =
      small && report.filePath
        ? [
            {
              filename: report.filePath.split('/').pop() as string,
              content: await this.storage.getBuffer(report.filePath),
              contentType: contentTypeFor(report.format),
            },
          ]
        : undefined;

    await this.mail.send({
      to: recipients,
      subject: `Report ready: ${schedule.template.name}`,
      html,
      attachments,
    });
  }
}

function contentTypeFor(format: string): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
