import { IsIn, IsOptional, IsString } from 'class-validator';
import { ReportFormat } from '@prisma/client';

export class ListReportsDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(['pdf', 'xlsx', 'csv'])
  format?: ReportFormat;

  @IsOptional()
  @IsString()
  generatedBy?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
