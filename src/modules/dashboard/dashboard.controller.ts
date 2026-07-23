import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { CurrentUser, AuthUser } from 'src/common/auth/current-user';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get(':templateId')
  getData(
    @Param('templateId') templateId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getData(templateId, query, user);
  }
}
