import {
  waitlistService,
  type WaitlistService
} from "../modules/waitlist/waitlist.service";
import type { JobRunOptions, JobRunResult } from "./jobs.types";

const jobName = "expire-waitlist-notifications";

export class ExpireWaitlistNotificationsJob {
  constructor(
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly waitlist: WaitlistService = waitlistService
  ) {}

  async run(options: JobRunOptions = {}): Promise<JobRunResult> {
    const result = await this.waitlist.expireNotifiedEntries({
      now: this.nowProvider(),
      batchSize: options.batchSize ?? 100
    });

    return {
      jobName,
      processed: result.processed
    };
  }
}

export const expireWaitlistNotificationsJob = new ExpireWaitlistNotificationsJob();
