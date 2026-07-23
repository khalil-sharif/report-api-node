import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthGuard } from './common/auth/auth.guard';
import { TemplatesModule } from './modules/templates/templates.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: config.get('redis') as { host: string; port: number; password?: string },
      }),
    }),
    CommonModule,
    TemplatesModule,
    ReportsModule,
    SchedulesModule,
    DashboardModule,
    MaintenanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
