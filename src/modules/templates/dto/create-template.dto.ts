import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ReportFormat } from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  dataQuery!: string;

  @IsOptional()
  @IsString()
  dataSource?: string;

  @IsObject()
  parametersSchema!: Record<string, unknown>;

  @IsArray()
  @ArrayNotEmpty()
  supportedFormats!: ReportFormat[];

  @IsObject()
  layoutConfig!: Record<string, unknown>;

  @IsArray()
  @ArrayNotEmpty()
  accessRoles!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  cacheTtlSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
