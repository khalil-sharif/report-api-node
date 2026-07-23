import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOB_CLEANUP, QUEUE_MAINTENANCE } from 'src/queue/queue.constants';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_MAINTENANCE })],
  providers: [MaintenanceProcessor],
})
export class MaintenanceModule implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_MAINTENANCE) private readonly queue: Queue,
  ) {}

  /** Register the repeatable daily cleanup job on boot (idempotent by jobId). */
  async onModuleInit(): Promise<void> {
    const cron = (this.config.get('retention') as { cleanupCron: string }).cleanupCron;
    await this.queue.add(
      JOB_CLEANUP,
      {},
      {
        repeat: { pattern: cron },
        jobId: 'maintenance:cleanup',
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );
  }
}
