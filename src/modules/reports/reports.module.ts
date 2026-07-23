import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_REPORTS } from 'src/queue/queue.constants';
import { DataSourceModule } from '../data-sources/data-source.module';
import { GeneratorsModule } from '../generators/generators.module';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    DataSourceModule,
    GeneratorsModule,
    BullModule.registerQueue({ name: QUEUE_REPORTS }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
