/** Queue names and job identifiers used across producers and workers. */
export const QUEUE_REPORTS = 'reports';
export const QUEUE_SCHEDULES = 'schedules';
export const QUEUE_MAINTENANCE = 'maintenance';

export const JOB_GENERATE = 'generate-report';
export const JOB_RUN_SCHEDULE = 'run-schedule';
export const JOB_CLEANUP = 'cleanup-expired';

export interface GenerateJobData {
  reportId: string;
  templateId: string;
  parameters: Record<string, unknown>;
  format: 'pdf' | 'xlsx' | 'csv';
  userId: string;
}

export interface RunScheduleJobData {
  scheduleId: string;
}
