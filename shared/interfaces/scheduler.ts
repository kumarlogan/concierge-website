export interface ScheduledTask {
  id: string;
  cron: string;
  handler: string;
  enabled: boolean;
}

export interface Scheduler {
  register(task: ScheduledTask): Promise<void>;
  list(): Promise<ScheduledTask[]>;
  trigger(id: string): Promise<void>;
}
