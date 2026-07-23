import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ReportSchedule } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  JOB_RUN_SCHEDULE,
  QUEUE_SCHEDULES,
  RunScheduleJobData,
} from 'src/queue/queue.constants';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

/**
 * CRUD for scheduled reports. Each active schedule is backed by a BullMQ
 * repeatable job keyed by the schedule id, so create/update/delete keep the
 * queue in sync with the database.
 */
@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_SCHEDULES) private readonly queue: Queue,
  ) {}

  async create(dto: CreateScheduleDto, userId: string): Promise<ReportSchedule> {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        templateId: dto.templateId,
        format: dto.format,
        parametersJson: dto.parameters as Prisma.InputJsonValue,
        cronExpression: dto.cronExpression,
        recipientsJson: dto.recipients as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        isActive: dto.isActive ?? true,
      },
    });

    if (schedule.isActive) await this.registerRepeatable(schedule);
    return schedule;
  }

  async findAll(): Promise<ReportSchedule[]> {
    return this.prisma.reportSchedule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<ReportSchedule> {
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto): Promise<ReportSchedule> {
    const existing = await this.findOne(id);
    await this.removeRepeatable(existing);

    const updated = await this.prisma.reportSchedule.update({
      where: { id },
      data: {
        format: dto.format,
        parametersJson: dto.parameters as Prisma.InputJsonValue | undefined,
        cronExpression: dto.cronExpression,
        recipientsJson: dto.recipients as unknown as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });

    if (updated.isActive) await this.registerRepeatable(updated);
    return updated;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.findOne(id);
    await this.removeRepeatable(existing);
    await this.prisma.reportSchedule.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async registerRepeatable(schedule: ReportSchedule): Promise<void> {
    const data: RunScheduleJobData = { scheduleId: schedule.id };
    await this.queue.add(JOB_RUN_SCHEDULE, data, {
      repeat: { pattern: schedule.cronExpression },
      jobId: `schedule:${schedule.id}`,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    this.logger.log(`Registered schedule ${schedule.id} (${schedule.cronExpression})`);
  }

  private async removeRepeatable(schedule: ReportSchedule): Promise<void> {
    try {
      await this.queue.removeRepeatable(JOB_RUN_SCHEDULE, {
        pattern: schedule.cronExpression,
        jobId: `schedule:${schedule.id}`,
      });
    } catch (err) {
      this.logger.warn(`Could not remove repeatable for ${schedule.id}: ${(err as Error).message}`);
    }
  }
}
