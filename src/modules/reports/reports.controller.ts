import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { CurrentUser, AuthUser } from 'src/common/auth/current-user';

@ApiTags('reports')
@Controller('reports')
@UseGuards(RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateReportDto, @CurrentUser() user: AuthUser) {
    return this.service.enqueue(dto, user);
  }

  @Get('generate/:jobId')
  status(@Param('jobId') jobId: string) {
    return this.service.getStatus(jobId);
  }

  @Get()
  list(@Query() query: ListReportsDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.download(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
