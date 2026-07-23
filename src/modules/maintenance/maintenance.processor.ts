import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StorageService } from 'src/common/storage/storage.service';
import { JOB_CLEANUP, QUEUE_MAINTENANCE } from 'src/queue/queue.constants';

/**
 * Daily cleanup: deletes generated reports whose expiresAt has passed,
 * removing both the storage object and the DB row.
 */
@Processor(QUEUE_MAINTENANCE, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ deleted: number }> {
    if (job.name !== JOB_CLEANUP) return { deleted: 0 };

    const expired = await this.prisma.generatedReport.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, filePath: true },
    });

    let deleted = 0;
    for (const report of expired) {
      if (report.filePath) {
        try {
          await this.storage.remove(report.filePath);
        } catch (err) {
          this.logger.warn(`Could not remove ${report.filePath}: ${(err as Error).message}`);
        }
      }
      await this.prisma.generatedReport.delete({ where: { id: report.id } });
      deleted += 1;
    }
    this.logger.log(`Cleanup removed ${deleted} expired report(s).`);
    return { deleted };
  }
}
