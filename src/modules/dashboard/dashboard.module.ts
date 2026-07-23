import { Module } from '@nestjs/common';
import { DataSourceModule } from '../data-sources/data-source.module';
import { GeneratorsModule } from '../generators/generators.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DataSourceModule, GeneratorsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
