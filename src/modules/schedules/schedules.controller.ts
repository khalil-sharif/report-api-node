import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Roles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { CurrentUser, AuthUser } from 'src/common/auth/current-user';

@ApiTags('schedules')
@Controller('schedules')
@UseGuards(RolesGuard)
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Post()
  @Roles('admin', 'analyst')
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put(':id')
  @Roles('admin', 'analyst')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'analyst')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
