import { NotificationType, Prisma, PrismaClient, WaitlistStatus } from "@prisma/client";

import { prisma } from "../config/prisma";
import {
  notificationsService,
  type NotificationsService
} from "../modules/notifications/notifications.service";
import type { JobRunOptions, JobRunResult } from "./jobs.types";

const jobName = "expire-waitlist-notifications";
const waitlistExpiredContent =
  "Your waitlist response window has expired. You can join the waitlist again if you still need the slot.";

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class ExpireWaitlistNotificationsJob {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly notifications: NotificationsService = notificationsService
  ) {}

  async run(options: JobRunOptions = {}): Promise<JobRunResult> {
    const now = this.nowProvider();
    const batchSize = options.batchSize ?? 100;
    const entries = await this.db.waitlistEntry.findMany({
      where: this.expirableWaitlistWhere(now),
      select: {
        waitlistEntryId: true,
        userId: true,
        status: true,
        expiresAt: true
      },
      orderBy: [{ expiresAt: "asc" }],
      take: batchSize
    });
    let processed = 0;

    for (const entry of entries) {
      const expired = await this.db.$transaction(
        async (tx) => this.expireEntryIfStillEligible(tx, entry.waitlistEntryId, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      if (expired) {
        processed += 1;
      }
    }

    return {
      jobName,
      processed
    };
  }

  private expirableWaitlistWhere(now: Date): Prisma.WaitlistEntryWhereInput {
    return {
      status: WaitlistStatus.NOTIFIED,
      expiresAt: {
        lt: now
      }
    };
  }

  private async expireEntryIfStillEligible(
    tx: Prisma.TransactionClient,
    waitlistEntryId: string,
    now: Date
  ): Promise<boolean> {
    const currentEntry = await tx.waitlistEntry.findFirst({
      where: {
        waitlistEntryId,
        ...this.expirableWaitlistWhere(now)
      },
      select: {
        waitlistEntryId: true,
        userId: true,
        status: true,
        expiresAt: true
      }
    });

    if (!currentEntry) {
      return false;
    }

    const updatedEntry = await tx.waitlistEntry.updateMany({
      where: {
        waitlistEntryId: currentEntry.waitlistEntryId,
        ...this.expirableWaitlistWhere(now)
      },
      data: {
        status: WaitlistStatus.EXPIRED
      }
    });

    if (updatedEntry.count === 0) {
      return false;
    }

    await this.notifications.createWaitlistNotification(tx, {
      userId: currentEntry.userId,
      notificationType: NotificationType.WAITLIST_EXPIRED,
      title: "Waitlist response expired",
      content: waitlistExpiredContent
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        entityType: "WAITLIST_ENTRY",
        entityId: currentEntry.waitlistEntryId,
        action: "AUTO_EXPIRE_WAITLIST_ENTRY",
        oldValue: jsonSafe({
          status: currentEntry.status,
          expiresAt: currentEntry.expiresAt
        }),
        newValue: jsonSafe({
          status: WaitlistStatus.EXPIRED
        })
      }
    });

    return true;
  }
}

export const expireWaitlistNotificationsJob = new ExpireWaitlistNotificationsJob();

