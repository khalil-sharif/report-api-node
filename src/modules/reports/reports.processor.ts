import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerateJobData, JOB_GENERATE, QUEUE_REPORTS } from 'src/queue/queue.constants';
import { ReportsService } from './reports.service';

/**
 * BullMQ worker for async report generation. Registered on the API and worker
 * processes; run the dedicated `worker` process in production to offload the API.
 */
@Processor(QUEUE_REPORTS, { concurrency: 3 })
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly reports: ReportsService) {
    super();
  }

  async process(job: Job<GenerateJobData>): Promise<{ reportId: string }> {
    if (job.name !== JOB_GENERATE) {
      this.logger.warn(`Ignoring unknown job "${job.name}"`);
      return { reportId: '' };
    }
    this.logger.log(`Processing generation job ${job.id} for report ${job.data.reportId}`);
    await this.reports.runGeneration({
      reportId: job.data.reportId,
      parameters: job.data.parameters,
    });
    return { reportId: job.data.reportId };
  }
}
