import { prisma } from "../config/prisma";
import { autoCompleteBookingItemsJob, type AutoCompleteBookingItemsJob } from "./auto-complete-booking-items.job";
import { expireCheckinJob, type ExpireCheckinJob } from "./expire-checkin.job";
import { expirePaymentHoldsJob, type ExpirePaymentHoldsJob } from "./expire-payment-holds.job";
import {
  expireWaitlistNotificationsJob,
  type ExpireWaitlistNotificationsJob
} from "./expire-waitlist-notifications.job";
import type { JobRunOptions, JobRunResult, JobsRunOnceResult } from "./jobs.types";

type RunnableJob = {
  run(options?: JobRunOptions): Promise<JobRunResult>;
};

export class JobsRunner {
  constructor(
    private readonly jobs: RunnableJob[] = [
      expirePaymentHoldsJob,
      expireCheckinJob,
      autoCompleteBookingItemsJob,
      expireWaitlistNotificationsJob
    ]
  ) {}

  async runOnce(options: JobRunOptions = {}): Promise<JobsRunOnceResult> {
    const results: JobRunResult[] = [];

    for (const job of this.jobs) {
      results.push(await job.run(options));
    }

    return {
      results,
      processed: results.reduce((sum, result) => sum + result.processed, 0)
    };
  }
}

export const jobsRunner = new JobsRunner();

export type SystemJob =
  | ExpirePaymentHoldsJob
  | ExpireCheckinJob
  | AutoCompleteBookingItemsJob
  | ExpireWaitlistNotificationsJob;

async function main(): Promise<void> {
  const result = await jobsRunner.runOnce();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  void main()
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
