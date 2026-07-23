import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ReportFormat } from '@prisma/client';

export class GenerateReportDto {
  @IsString()
  templateId!: string;

  @IsIn(['pdf', 'xlsx', 'csv'])
  format!: ReportFormat;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
