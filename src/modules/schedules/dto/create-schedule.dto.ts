import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ReportFormat } from '@prisma/client';

export class CreateScheduleDto {
  @IsString()
  templateId!: string;

  @IsIn(['pdf', 'xlsx', 'csv'])
  format!: ReportFormat;

  @IsObject()
  parameters!: Record<string, unknown>;

  /** Standard 5-field cron expression, e.g. "0 8 * * 1" (Mon 08:00). */
  @IsString()
  cronExpression!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recipients!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
