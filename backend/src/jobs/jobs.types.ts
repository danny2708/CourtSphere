export type JobRunOptions = {
  batchSize?: number;
};

export type JobRunResult = {
  jobName: string;
  processed: number;
};

export type JobsRunOnceResult = {
  results: JobRunResult[];
  processed: number;
};
