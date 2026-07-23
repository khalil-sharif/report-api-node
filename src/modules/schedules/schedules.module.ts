import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_SCHEDULES } from 'src/queue/queue.constants';
import { ReportsModule } from '../reports/reports.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesProcessor } from './schedules.processor';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [ReportsModule, BullModule.registerQueue({ name: QUEUE_SCHEDULES })],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesProcessor],
  exports: [SchedulesService],
})
export class SchedulesModule {}
