import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  PaymentStatus,
  PrismaClient,
  RefundStatus,
  ViolationType,
  WaitlistStatus
} from "@prisma/client";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const demoPrefix = "[REPORT_DEMO]";
const seedPassword = "Password123!";

function seedUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

const userIds = {
  alice: seedUuid(9001),
  bob: seedUuid(9002),
  charlie: seedUuid(9003),
  dana: seedUuid(9004)
};

const bookingOrderIds = Array.from({ length: 12 }, (_, index) => seedUuid(9101 + index));
const bookingItemIds = Array.from({ length: 14 }, (_, index) => seedUuid(9201 + index));
const paymentIds = Array.from({ length: 12 }, (_, index) => seedUuid(9301 + index));
const refundIds = {
  dayThreeUserCancel: seedUuid(9401)
};
const violationIds = {
  aliceLateCancel: seedUuid(9501),
  aliceNoShow: seedUuid(9502),
  bobNoShow: seedUuid(9503)
};
const waitlistEntryIds = Array.from({ length: 4 }, (_, index) => seedUuid(9601 + index));

const courtIds = {
  footballA: seedUuid(101),
  badmintonA: seedUuid(102),
  basketballA: seedUuid(103),
  footballB: seedUuid(104)
};

type DemoUserKey = keyof typeof userIds;
type DemoCourtKey = keyof typeof courtIds;

type DemoItemInput = {
  id: string;
  court: DemoCourtKey;
  startHour: number;
  amount: string;
  status: BookingStatus;
};

type DemoOrderInput = {
  id: string;
  code: string;
  user: DemoUserKey;
  dayOffset: number;
  createdHour: number;
  amount: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  items: DemoItemInput[];
  cancelReason?: string;
  cancelledBy?: DemoUserKey | "manager";
  paymentId: string;
};

function reportDate(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

async function requireBaseData() {
  const [studentGroup, userRole, adminUser, managerUser, footballA, badmintonA, basketballA, footballB] =
    await Promise.all([
      prisma.priorityGroup.findUnique({ where: { groupCode: "STUDENT" } }),
      prisma.role.findUnique({ where: { roleName: "USER" } }),
      prisma.user.findUnique({ where: { email: "admin@courtsphere.local" } }),
      prisma.user.findUnique({ where: { email: "manager@courtsphere.local" } }),
      prisma.court.findUnique({ where: { courtId: courtIds.footballA } }),
      prisma.court.findUnique({ where: { courtId: courtIds.badmintonA } }),
      prisma.court.findUnique({ where: { courtId: courtIds.basketballA } }),
      prisma.court.findUnique({ where: { courtId: courtIds.footballB } })
    ]);

  const missing = [
    !studentGroup ? "priority group STUDENT" : null,
    !userRole ? "role USER" : null,
    !adminUser ? "admin@courtsphere.local" : null,
    !managerUser ? "manager@courtsphere.local" : null,
    !footballA ? "San bong da A" : null,
    !badmintonA ? "San cau long A" : null,
    !basketballA ? "San bong ro A" : null,
    !footballB ? "San bong da B" : null
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Run npm run seed before seed:reports. Missing: ${missing.join(", ")}`);
  }

  return {
    adminUser: adminUser!,
    managerUser: managerUser!,
    studentGroup: studentGroup!,
    userRole: userRole!,
    courts: {
      footballA: footballA!,
      badmintonA: badmintonA!,
      basketballA: basketballA!,
      footballB: footballB!
    }
  };
}

async function cleanupDemoData() {
  const existingDemoOrders = await prisma.bookingOrder.findMany({
    where: {
      OR: [
        { bookingOrderId: { in: bookingOrderIds } },
        { bookingCode: { startsWith: "REPORT-DEMO-" } },
        { note: { startsWith: demoPrefix } }
      ]
    },
    select: { bookingOrderId: true }
  });
  const orderIds = [...new Set([...bookingOrderIds, ...existingDemoOrders.map((order) => order.bookingOrderId)])];

  const existingDemoItems = await prisma.bookingItem.findMany({
    where: {
      OR: [{ bookingItemId: { in: bookingItemIds } }, { bookingOrderId: { in: orderIds } }]
    },
    select: { bookingItemId: true }
  });
  const itemIds = [...new Set([...bookingItemIds, ...existingDemoItems.map((item) => item.bookingItemId)])];

  const existingDemoPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { paymentId: { in: paymentIds } },
        { bookingOrderId: { in: orderIds } },
        { gatewayTransactionId: { startsWith: "report_demo_" } }
      ]
    },
    select: { paymentId: true }
  });
  const demoPaymentIds = [...new Set([...paymentIds, ...existingDemoPayments.map((payment) => payment.paymentId)])];
  const demoUserIds = Object.values(userIds);

  await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: demoUserIds } },
        { bookingOrderId: { in: orderIds } },
        { bookingItemId: { in: itemIds } }
      ]
    }
  });
  await prisma.violation.deleteMany({
    where: {
      OR: [
        { violationId: { in: Object.values(violationIds) } },
        { userId: { in: demoUserIds } },
        { bookingItemId: { in: itemIds } },
        { description: { startsWith: demoPrefix } }
      ]
    }
  });
  await prisma.refund.deleteMany({
    where: {
      OR: [
        { refundId: { in: Object.values(refundIds) } },
        { paymentId: { in: demoPaymentIds } },
        { bookingOrderId: { in: orderIds } },
        { bookingItemId: { in: itemIds } },
        { gatewayRefundId: { startsWith: "report_demo_" } }
      ]
    }
  });
  await prisma.bookingItemStatusHistory.deleteMany({ where: { bookingItemId: { in: itemIds } } });
  await prisma.bookingOrderStatusHistory.deleteMany({ where: { bookingOrderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { paymentId: { in: demoPaymentIds } } });
  await prisma.bookingItem.deleteMany({ where: { bookingItemId: { in: itemIds } } });
  await prisma.bookingOrder.deleteMany({ where: { bookingOrderId: { in: orderIds } } });
  await prisma.waitlistEntry.deleteMany({
    where: {
      OR: [{ waitlistEntryId: { in: waitlistEntryIds } }, { userId: { in: demoUserIds } }]
    }
  });
  await prisma.userRole.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.user.deleteMany({
    where: {
      OR: [{ userId: { in: demoUserIds } }, { email: { startsWith: "report.demo." } }]
    }
  });
}

async function seedDemoUsers(input: {
  passwordHash: string;
  priorityGroupId: string;
  roleId: string;
}) {
  const users = [
    {
      userId: userIds.alice,
      fullName: "Report Demo Alice",
      email: "report.demo.alice@courtsphere.local",
      phoneNumber: "0980009001",
      identityCode: "REPORT-DEMO-001",
      violationPoints: 4,
      bookingPermissionStatus: BookingPermissionStatus.RESTRICTED
    },
    {
      userId: userIds.bob,
      fullName: "Report Demo Bob",
      email: "report.demo.bob@courtsphere.local",
      phoneNumber: "0980009002",
      identityCode: "REPORT-DEMO-002",
      violationPoints: 2,
      bookingPermissionStatus: BookingPermissionStatus.ALLOWED
    },
    {
      userId: userIds.charlie,
      fullName: "Report Demo Charlie",
      email: "report.demo.charlie@courtsphere.local",
      phoneNumber: "0980009003",
      identityCode: "REPORT-DEMO-003",
      violationPoints: 0,
      bookingPermissionStatus: BookingPermissionStatus.ALLOWED
    },
    {
      userId: userIds.dana,
      fullName: "Report Demo Dana",
      email: "report.demo.dana@courtsphere.local",
      phoneNumber: "0980009004",
      identityCode: "REPORT-DEMO-004",
      violationPoints: 0,
      bookingPermissionStatus: BookingPermissionStatus.ALLOWED
    }
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        ...user,
        passwordHash: input.passwordHash,
        priorityGroupId: input.priorityGroupId,
        accountStatus: AccountStatus.ACTIVE,
        bookingLockedUntil:
          user.bookingPermissionStatus === BookingPermissionStatus.RESTRICTED ? reportDate(2, 0) : null,
        reputationPoints: Math.max(40, 100 - user.violationPoints * 10),
        createdAt: reportDate(-7, 8)
      }
    });

    await prisma.userRole.create({
      data: {
        userId: user.userId,
        roleId: input.roleId
      }
    });
  }
}

function buildOrders(): DemoOrderInput[] {
  return [
    {
      id: bookingOrderIds[0],
      code: "REPORT-DEMO-202605-A01",
      user: "charlie",
      dayOffset: -5,
      createdHour: 8,
      amount: "120000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[0],
      items: [
        { id: bookingItemIds[0], court: "footballA", startHour: 9, amount: "120000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[1],
      code: "REPORT-DEMO-202605-A02",
      user: "dana",
      dayOffset: -5,
      createdHour: 9,
      amount: "80000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[1],
      items: [
        { id: bookingItemIds[1], court: "badmintonA", startHour: 10, amount: "80000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[2],
      code: "REPORT-DEMO-202605-B01",
      user: "alice",
      dayOffset: -4,
      createdHour: 8,
      amount: "200000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[2],
      items: [
        { id: bookingItemIds[2], court: "footballA", startHour: 8, amount: "120000.00", status: BookingStatus.COMPLETED },
        { id: bookingItemIds[3], court: "footballA", startHour: 9, amount: "80000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[3],
      code: "REPORT-DEMO-202605-B02",
      user: "bob",
      dayOffset: -4,
      createdHour: 10,
      amount: "100000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[3],
      items: [
        { id: bookingItemIds[4], court: "footballA", startHour: 11, amount: "100000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[4],
      code: "REPORT-DEMO-202605-B03",
      user: "bob",
      dayOffset: -4,
      createdHour: 12,
      amount: "100000.00",
      status: BookingStatus.NO_SHOW,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[4],
      items: [
        { id: bookingItemIds[5], court: "badmintonA", startHour: 13, amount: "100000.00", status: BookingStatus.NO_SHOW }
      ]
    },
    {
      id: bookingOrderIds[5],
      code: "REPORT-DEMO-202605-C01",
      user: "charlie",
      dayOffset: -3,
      createdHour: 8,
      amount: "200000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[5],
      items: [
        { id: bookingItemIds[6], court: "footballA", startHour: 8, amount: "120000.00", status: BookingStatus.COMPLETED },
        { id: bookingItemIds[7], court: "footballA", startHour: 9, amount: "80000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[6],
      code: "REPORT-DEMO-202605-C02",
      user: "alice",
      dayOffset: -3,
      createdHour: 10,
      amount: "100000.00",
      status: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[6],
      cancelReason: `${demoPrefix} Late cancellation demo`,
      cancelledBy: "alice",
      items: [
        { id: bookingItemIds[8], court: "basketballA", startHour: 11, amount: "100000.00", status: BookingStatus.CANCELLED_BY_USER }
      ]
    },
    {
      id: bookingOrderIds[7],
      code: "REPORT-DEMO-202605-C03",
      user: "alice",
      dayOffset: -3,
      createdHour: 12,
      amount: "200000.00",
      status: BookingStatus.NO_SHOW,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[7],
      items: [
        { id: bookingItemIds[9], court: "badmintonA", startHour: 13, amount: "200000.00", status: BookingStatus.NO_SHOW }
      ]
    },
    {
      id: bookingOrderIds[8],
      code: "REPORT-DEMO-202605-C04",
      user: "dana",
      dayOffset: -3,
      createdHour: 14,
      amount: "150000.00",
      status: BookingStatus.PAYMENT_EXPIRED,
      paymentStatus: PaymentStatus.EXPIRED,
      paymentId: paymentIds[8],
      items: [
        { id: bookingItemIds[10], court: "basketballA", startHour: 15, amount: "150000.00", status: BookingStatus.PAYMENT_EXPIRED }
      ]
    },
    {
      id: bookingOrderIds[9],
      code: "REPORT-DEMO-202605-D01",
      user: "dana",
      dayOffset: -2,
      createdHour: 9,
      amount: "100000.00",
      status: BookingStatus.CANCELLED_BY_MANAGER,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[9],
      cancelReason: `${demoPrefix} Facility issue demo`,
      cancelledBy: "manager",
      items: [
        { id: bookingItemIds[11], court: "footballB", startHour: 10, amount: "100000.00", status: BookingStatus.CANCELLED_BY_MANAGER }
      ]
    },
    {
      id: bookingOrderIds[10],
      code: "REPORT-DEMO-202605-E01",
      user: "charlie",
      dayOffset: -1,
      createdHour: 8,
      amount: "180000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[10],
      items: [
        { id: bookingItemIds[12], court: "footballA", startHour: 9, amount: "180000.00", status: BookingStatus.COMPLETED }
      ]
    },
    {
      id: bookingOrderIds[11],
      code: "REPORT-DEMO-202605-E02",
      user: "bob",
      dayOffset: -1,
      createdHour: 10,
      amount: "120000.00",
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentId: paymentIds[11],
      items: [
        { id: bookingItemIds[13], court: "basketballA", startHour: 11, amount: "120000.00", status: BookingStatus.COMPLETED }
      ]
    }
  ];
}

async function seedBookingsAndPayments(input: {
  managerUserId: string;
}) {
  const orders = buildOrders();

  for (const order of orders) {
    const createdAt = reportDate(order.dayOffset, order.createdHour);
    const cancelledByUserId =
      order.cancelledBy === "manager"
        ? input.managerUserId
        : order.cancelledBy && order.cancelledBy in userIds
          ? userIds[order.cancelledBy as DemoUserKey]
          : null;

    await prisma.bookingOrder.create({
      data: {
        bookingOrderId: order.id,
        bookingCode: order.code,
        userId: userIds[order.user],
        totalAmount: order.amount,
        bookingStatus: order.status,
        paymentStatus: order.paymentStatus,
        refundable: order.status !== BookingStatus.CANCELLED_BY_USER,
        holdExpiresAt: order.paymentStatus === PaymentStatus.EXPIRED ? addMinutes(createdAt, 10) : null,
        note: `${demoPrefix} Admin reports demo order`,
        cancelReason: order.cancelReason ?? null,
        cancelledByUserId,
        cancelledAt: cancelledByUserId ? addMinutes(createdAt, 30) : null,
        createdAt
      }
    });

    for (const item of order.items) {
      await prisma.bookingItem.create({
        data: {
          bookingItemId: item.id,
          bookingOrderId: order.id,
          courtId: courtIds[item.court],
          startDatetime: reportDate(order.dayOffset, item.startHour),
          endDatetime: reportDate(order.dayOffset, item.startHour + 1),
          unitPrice: item.amount,
          amount: item.amount,
          bookingStatus: item.status,
          checkinTime:
            item.status === BookingStatus.COMPLETED ? addMinutes(reportDate(order.dayOffset, item.startHour), 2) : null,
          completedByUserId: item.status === BookingStatus.COMPLETED ? input.managerUserId : null,
          noShowMarkedByUserId: item.status === BookingStatus.NO_SHOW ? input.managerUserId : null,
          managerNote: item.status === BookingStatus.NO_SHOW ? `${demoPrefix} No-show report demo` : null,
          createdAt
        }
      });
    }

    const isSuccess = order.paymentStatus === PaymentStatus.SUCCESS;
    await prisma.payment.create({
      data: {
        paymentId: order.paymentId,
        bookingOrderId: order.id,
        userId: userIds[order.user],
        amount: order.amount,
        paymentMethod: "MOCK",
        gatewayTransactionId: `report_demo_${order.code.toLowerCase()}`,
        paymentStatus: order.paymentStatus,
        rawCallback: { provider: "report-demo", status: order.paymentStatus },
        paidAt: isSuccess ? addMinutes(createdAt, 5) : null,
        createdAt: addMinutes(createdAt, 2)
      }
    });
  }

  await prisma.refund.create({
    data: {
      refundId: refundIds.dayThreeUserCancel,
      paymentId: paymentIds[6],
      bookingOrderId: bookingOrderIds[6],
      bookingItemId: bookingItemIds[8],
      refundAmount: "100000.00",
      refundReason: `${demoPrefix} Successful refund for reports demo`,
      refundStatus: RefundStatus.SUCCESS,
      requestedByUserId: userIds.alice,
      processedByUserId: input.managerUserId,
      gatewayRefundId: "report_demo_refund_001",
      requestedAt: addMinutes(reportDate(-3, 10), 35),
      processedAt: addMinutes(reportDate(-3, 10), 45)
    }
  });
}

async function seedViolations(input: { managerUserId: string }) {
  const violations = [
    {
      violationId: violationIds.aliceLateCancel,
      userId: userIds.alice,
      bookingItemId: bookingItemIds[8],
      violationType: ViolationType.LATE_CANCEL,
      penaltyPoints: 1,
      description: `${demoPrefix} Late cancellation report demo`,
      recordedByUserId: null,
      isWaived: false,
      recordedAt: addMinutes(reportDate(-3, 10), 50)
    },
    {
      violationId: violationIds.aliceNoShow,
      userId: userIds.alice,
      bookingItemId: bookingItemIds[9],
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 3,
      description: `${demoPrefix} No-show report demo`,
      recordedByUserId: input.managerUserId,
      isWaived: false,
      recordedAt: addMinutes(reportDate(-3, 13), 20)
    },
    {
      violationId: violationIds.bobNoShow,
      userId: userIds.bob,
      bookingItemId: bookingItemIds[5],
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 2,
      description: `${demoPrefix} No-show report demo`,
      recordedByUserId: input.managerUserId,
      isWaived: false,
      recordedAt: addMinutes(reportDate(-4, 13), 20)
    }
  ];

  for (const violation of violations) {
    await prisma.violation.create({ data: violation });
  }
}

async function seedWaitlist(priorityGroupId: string) {
  const waitlistEntries = [
    {
      waitlistEntryId: waitlistEntryIds[0],
      userId: userIds.alice,
      courtId: courtIds.footballA,
      priorityGroupId,
      desiredStartDatetime: reportDate(-4, 15),
      desiredEndDatetime: reportDate(-4, 16),
      priorityOrder: 20,
      status: WaitlistStatus.WAITING,
      registeredAt: reportDate(-4, 9),
      notifiedAt: null,
      expiresAt: null
    },
    {
      waitlistEntryId: waitlistEntryIds[1],
      userId: userIds.bob,
      courtId: courtIds.badmintonA,
      priorityGroupId,
      desiredStartDatetime: reportDate(-3, 16),
      desiredEndDatetime: reportDate(-3, 17),
      priorityOrder: 20,
      status: WaitlistStatus.EXPIRED,
      registeredAt: reportDate(-3, 9),
      notifiedAt: reportDate(-3, 10),
      expiresAt: reportDate(-3, 10, 10)
    },
    {
      waitlistEntryId: waitlistEntryIds[2],
      userId: userIds.charlie,
      courtId: courtIds.basketballA,
      priorityGroupId,
      desiredStartDatetime: reportDate(-2, 16),
      desiredEndDatetime: reportDate(-2, 17),
      priorityOrder: 20,
      status: WaitlistStatus.NOTIFIED,
      registeredAt: reportDate(-2, 9),
      notifiedAt: reportDate(-2, 10),
      expiresAt: reportDate(1, 10)
    },
    {
      waitlistEntryId: waitlistEntryIds[3],
      userId: userIds.dana,
      courtId: courtIds.footballB,
      priorityGroupId,
      desiredStartDatetime: reportDate(-1, 16),
      desiredEndDatetime: reportDate(-1, 17),
      priorityOrder: 20,
      status: WaitlistStatus.BOOKED,
      registeredAt: reportDate(-1, 9),
      notifiedAt: reportDate(-1, 10),
      expiresAt: reportDate(-1, 10, 10)
    }
  ];

  for (const entry of waitlistEntries) {
    await prisma.waitlistEntry.create({ data: entry });
  }
}

async function main() {
  const baseData = await requireBaseData();
  await cleanupDemoData();

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  await seedDemoUsers({
    passwordHash,
    priorityGroupId: baseData.studentGroup.priorityGroupId,
    roleId: baseData.userRole.roleId
  });
  await seedBookingsAndPayments({ managerUserId: baseData.managerUser.userId });
  await seedViolations({ managerUserId: baseData.managerUser.userId });
  await seedWaitlist(baseData.studentGroup.priorityGroupId);

  console.log("Report demo seed completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
